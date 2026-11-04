import "server-only";
import { and, count, desc, eq, gt, gte, or, sql, sum } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import {
  aiUsage,
  analyses,
  jobDescriptions,
  profiles,
  resumes,
  resumeVersions,
  suggestionDecisions,
  summaryDecisions,
} from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { PARSE_CV_PROMPT } from "@/lib/ai/prompts/parse-cv";
import { PARSE_JD_PROMPT } from "@/lib/ai/prompts/parse-jd";
import type { UsageRecord } from "@/lib/ai/run-step";
import type { Job } from "@/lib/ai/schemas/job";
import type { Resume } from "@/lib/ai/schemas/resume";
import { parseCv } from "@/lib/ai/steps/parse-cv";
import { parseJd } from "@/lib/ai/steps/parse-jd";
import { monthlyLimit } from "@/lib/billing/limits";
import { STALE_RUN_MS, hasQuotaLeft, quotaWindowStart, type QuotaStatus } from "@/lib/billing/quota";
import type { CvUpload } from "@/lib/parsing/cv-document";
import type { AnalysisOutcome, Stored } from "./run-analysis";
import {
  MAX_SUGGESTION_TEXT,
  type AnalysisReport,
  type Choice,
  type Choices,
  type SavedJob,
  type SuggestionTarget,
} from "./types";

// Every function takes the signed-in user's id and scopes its queries to it:
// the database connection bypasses RLS.

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Runs that hold quota this month: completed, or still running and not stale. */
async function quotaFor(db: Db | Tx, userId: string, now = new Date()): Promise<QuotaStatus> {
  const [{ used }] = await db
    .select({ used: count() })
    .from(analyses)
    .where(
      and(
        eq(analyses.userId, userId),
        gte(analyses.createdAt, quotaWindowStart(now)),
        or(
          eq(analyses.status, "completed"),
          and(eq(analyses.status, "running"), gt(analyses.createdAt, new Date(now.getTime() - STALE_RUN_MS))),
        ),
      ),
    );
  return { used, limit: await monthlyLimit(db, userId, "analysis") };
}

export function getQuota(userId: string): Promise<QuotaStatus> {
  return quotaFor(getDb(), userId);
}

/** An earlier completed analysis with identical inputs, which can be shown without new AI calls. */
export async function findCachedAnalysis(userId: string, cacheKey: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ id: analyses.id })
    .from(analyses)
    .where(and(eq(analyses.userId, userId), eq(analyses.cacheKey, cacheKey), eq(analyses.status, "completed")))
    .orderBy(desc(analyses.createdAt))
    .limit(1);
  return row?.id ?? null;
}

/**
 * Creates the analysis row in "running" state if the user has quota left. A
 * per-user advisory lock makes the check and the insert atomic, so parallel
 * requests can't overspend.
 */
export function reserveAnalysis(
  userId: string,
  run: { cacheKey: string; uiLocale: Locale; promptVersions: string[]; parentId?: string },
): Promise<{ id: string } | { quota: QuotaStatus }> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${userId}))`);
    await tx.insert(profiles).values({ id: userId }).onConflictDoNothing();
    const quota = await quotaFor(tx, userId);
    if (!hasQuotaLeft(quota)) return { quota };
    const [row] = await tx
      .insert(analyses)
      .values({ userId, status: "running", ...run })
      .returning({ id: analyses.id });
    return { id: row.id };
  });
}

export async function recordUsage(userId: string, analysisId: string, usage: UsageRecord): Promise<void> {
  await getDb().insert(aiUsage).values({
    userId,
    analysisId,
    step: usage.step,
    provider: usage.provider,
    model: usage.model,
    requestId: usage.requestId,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    cacheWriteTokens: usage.cacheWriteTokens,
    cacheReadTokens: usage.cacheReadTokens,
    costUsd: usage.costUsd.toFixed(6),
    durationMs: usage.durationMs,
  });
}

/** Reuses this user's earlier parse of the same file, otherwise parses and stores it. */
export async function loadOrParseResume(
  userId: string,
  upload: CvUpload,
  onUsage: (usage: UsageRecord) => Promise<void>,
): Promise<Stored<Resume>> {
  const db = getDb();
  const [existing] = await db
    .select({ id: resumeVersions.id, parsed: resumeVersions.parsed })
    .from(resumeVersions)
    .innerJoin(resumes, eq(resumes.id, resumeVersions.resumeId))
    .where(
      and(
        eq(resumes.userId, userId),
        eq(resumeVersions.contentHash, upload.contentHash),
        eq(resumeVersions.promptVersion, PARSE_CV_PROMPT.version),
      ),
    )
    .orderBy(desc(resumeVersions.createdAt))
    .limit(1);
  if (existing) return { id: existing.id, value: existing.parsed };

  const { output, usage } = await parseCv(upload.document);
  await onUsage(usage);
  const id = await db.transaction(async (tx) => {
    const [resume] = await tx
      .insert(resumes)
      .values({ userId, title: upload.fileName.slice(0, 200) })
      .returning({ id: resumes.id });
    const [version] = await tx
      .insert(resumeVersions)
      .values({
        resumeId: resume.id,
        version: 1,
        source: "upload",
        contentHash: upload.contentHash,
        parsed: output,
        promptVersion: PARSE_CV_PROMPT.version,
      })
      .returning({ id: resumeVersions.id });
    return version.id;
  });
  return { id, value: output };
}

/**
 * Stores a resume derived from an earlier version (suggestions and hand edits applied)
 * as the next version of the same resume, or reuses an identical one.
 */
export function saveRevisedResume(fromVersionId: string, parsed: Resume, contentHash: string): Promise<Stored<Resume>> {
  return getDb().transaction(async (tx) => {
    const [source] = await tx
      .select({ resumeId: resumeVersions.resumeId })
      .from(resumeVersions)
      .where(eq(resumeVersions.id, fromVersionId));
    const [existing] = await tx
      .select({ id: resumeVersions.id })
      .from(resumeVersions)
      .where(and(eq(resumeVersions.resumeId, source.resumeId), eq(resumeVersions.contentHash, contentHash)))
      .limit(1);
    if (existing) return { id: existing.id, value: parsed };

    const [{ next }] = await tx
      .select({ next: sql<number>`coalesce(max(${resumeVersions.version}), 0) + 1` })
      .from(resumeVersions)
      .where(eq(resumeVersions.resumeId, source.resumeId));
    const [version] = await tx
      .insert(resumeVersions)
      .values({ resumeId: source.resumeId, version: next, source: "suggestions", contentHash, parsed })
      .returning({ id: resumeVersions.id });
    return { id: version.id, value: parsed };
  });
}

/** JDs are shared across users: one parse per distinct JD text and prompt version. */
export async function loadOrParseJob(
  jdText: string,
  jdHash: string,
  onUsage: (usage: UsageRecord) => Promise<void>,
): Promise<Stored<Job>> {
  const db = getDb();
  const [existing] = await db
    .select({ id: jobDescriptions.id, parsed: jobDescriptions.parsed, promptVersion: jobDescriptions.promptVersion })
    .from(jobDescriptions)
    .where(eq(jobDescriptions.contentHash, jdHash));
  if (existing?.promptVersion === PARSE_JD_PROMPT.version) return { id: existing.id, value: existing.parsed };

  const { output, usage } = await parseJd(jdText);
  await onUsage(usage);
  const values = { rawText: jdText, parsed: output, promptVersion: PARSE_JD_PROMPT.version };
  const [row] = await db
    .insert(jobDescriptions)
    .values({ contentHash: jdHash, ...values })
    .onConflictDoUpdate({ target: jobDescriptions.contentHash, set: values })
    .returning({ id: jobDescriptions.id });
  return { id: row.id, value: output };
}

export async function completeAnalysis(analysisId: string, outcome: AnalysisOutcome): Promise<void> {
  await getDb()
    .update(analyses)
    .set({
      status: "completed",
      resumeVersionId: outcome.resumeVersionId,
      jobDescriptionId: outcome.jobDescriptionId,
      market: outcome.market,
      ats: outcome.ats,
      result: outcome.analysis,
      completedAt: new Date(),
    })
    .where(eq(analyses.id, analysisId));
}

export async function failAnalysis(analysisId: string, errorCode: string): Promise<void> {
  await getDb().update(analyses).set({ status: "failed", errorCode }).where(eq(analyses.id, analysisId));
}

export interface AnalysisListItem {
  id: string;
  status: (typeof analyses.$inferSelect)["status"];
  createdAt: Date;
  overall: number | null;
  jobTitle: string | null;
  company: string | null;
  resumeTitle: string | null;
  /** Re-evaluates the revised CV of an earlier analysis. */
  revised: boolean;
  /** That earlier analysis's score, to show the improvement. */
  previousOverall: number | null;
}

export async function listAnalyses(userId: string, limit = 50): Promise<AnalysisListItem[]> {
  const parent = alias(analyses, "parent");
  const rows = await getDb()
    .select({
      id: analyses.id,
      status: analyses.status,
      createdAt: analyses.createdAt,
      ats: analyses.ats,
      job: jobDescriptions.parsed,
      resumeTitle: resumes.title,
      parentId: analyses.parentId,
      parentAts: parent.ats,
    })
    .from(analyses)
    .leftJoin(parent, and(eq(parent.id, analyses.parentId), eq(parent.userId, userId)))
    .leftJoin(jobDescriptions, eq(jobDescriptions.id, analyses.jobDescriptionId))
    .leftJoin(resumeVersions, eq(resumeVersions.id, analyses.resumeVersionId))
    .leftJoin(resumes, eq(resumes.id, resumeVersions.resumeId))
    .where(eq(analyses.userId, userId))
    .orderBy(desc(analyses.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    createdAt: row.createdAt,
    overall: row.ats?.overall ?? null,
    jobTitle: row.job?.title ?? null,
    company: row.job?.company ?? null,
    resumeTitle: row.resumeTitle,
    revised: row.parentId !== null,
    previousOverall: row.parentAts?.overall ?? null,
  }));
}

/** JDs the user has analyzed against, latest use first, one entry per JD, each with its latest analysis. */
export async function listSavedJobs(
  userId: string,
  limit = 20,
): Promise<{ analysisId: string; title: string | null; company: string | null; usedAt: Date }[]> {
  const rows = await getDb()
    .select({
      analysisId: analyses.id,
      jobId: analyses.jobDescriptionId,
      usedAt: analyses.createdAt,
      job: jobDescriptions.parsed,
    })
    .from(analyses)
    .innerJoin(jobDescriptions, eq(jobDescriptions.id, analyses.jobDescriptionId))
    .where(and(eq(analyses.userId, userId), eq(analyses.status, "completed")))
    .orderBy(desc(analyses.createdAt))
    .limit(200);

  const seen = new Set<string | null>();
  return rows
    .filter((row) => !seen.has(row.jobId) && Boolean(seen.add(row.jobId)))
    .slice(0, limit)
    .map((row) => ({ analysisId: row.analysisId, title: row.job.title, company: row.job.company, usedAt: row.usedAt }));
}

/** The JD of the user's own analysis. JD rows are shared, so they are only reachable through an owned analysis. */
export async function getSavedJob(userId: string, analysisId: string): Promise<SavedJob | null> {
  if (!isUuid(analysisId)) return null;
  const [row] = await getDb()
    .select({ jd: jobDescriptions.rawText, job: jobDescriptions.parsed, market: analyses.market })
    .from(analyses)
    .innerJoin(jobDescriptions, eq(jobDescriptions.id, analyses.jobDescriptionId))
    .where(and(eq(analyses.id, analysisId), eq(analyses.userId, userId), eq(analyses.status, "completed")));
  if (!row) return null;
  return { analysisId, jd: row.jd, market: row.market ?? "auto", title: row.job.title, company: row.job.company };
}

/** `analysisId` when it is the user's completed analysis of the JD with this hash, so a new upload can be compared with it. */
export async function sameJobAnalysis(userId: string, analysisId: string, jdHash: string): Promise<string | null> {
  if (!isUuid(analysisId)) return null;
  const [row] = await getDb()
    .select({ id: analyses.id })
    .from(analyses)
    .innerJoin(jobDescriptions, eq(jobDescriptions.id, analyses.jobDescriptionId))
    .where(
      and(
        eq(analyses.id, analysisId),
        eq(analyses.userId, userId),
        eq(analyses.status, "completed"),
        eq(jobDescriptions.contentHash, jdHash),
      ),
    );
  return row?.id ?? null;
}

export async function getAnalysisReport(
  userId: string,
  analysisId: string,
): Promise<{ report: AnalysisReport; choices: Choices } | null> {
  if (!isUuid(analysisId)) return null;
  const db = getDb();
  const [row] = await db
    .select({
      id: analyses.id,
      parentId: analyses.parentId,
      market: analyses.market,
      ats: analyses.ats,
      result: analyses.result,
      resume: resumeVersions.parsed,
      job: jobDescriptions.parsed,
    })
    .from(analyses)
    .innerJoin(resumeVersions, eq(resumeVersions.id, analyses.resumeVersionId))
    .innerJoin(jobDescriptions, eq(jobDescriptions.id, analyses.jobDescriptionId))
    .where(and(eq(analyses.id, analysisId), eq(analyses.userId, userId), eq(analyses.status, "completed")));
  if (!row?.ats || !row.result || !row.market) return null;

  const [bulletRows, [summary], [cost], [parent]] = await Promise.all([
    db
      .select({
        index: suggestionDecisions.suggestionIndex,
        decision: suggestionDecisions.decision,
        text: suggestionDecisions.editedText,
      })
      .from(suggestionDecisions)
      .where(eq(suggestionDecisions.analysisId, analysisId)),
    db
      .select({ decision: summaryDecisions.decision, text: summaryDecisions.editedText })
      .from(summaryDecisions)
      .where(eq(summaryDecisions.analysisId, analysisId)),
    db.select({ total: sum(aiUsage.costUsd) }).from(aiUsage).where(eq(aiUsage.analysisId, analysisId)),
    row.parentId
      ? db
          .select({ id: analyses.id, ats: analyses.ats })
          .from(analyses)
          .where(and(eq(analyses.id, row.parentId), eq(analyses.userId, userId)))
      : Promise.resolve([]),
  ]);

  return {
    report: {
      id: row.id,
      resume: row.resume,
      job: row.job,
      market: row.market,
      ats: row.ats,
      analysis: row.result,
      costUsd: Number(cost?.total ?? 0),
      previous: parent?.ats ? { id: parent.id, overall: parent.ats.overall } : null,
    },
    choices: {
      bullets: Object.fromEntries(bulletRows.map(({ index, decision, text }) => [index, { decision, text }])),
      summary: summary ?? null,
    },
  };
}

/** Saves or clears the user's choice on one suggestion of their own analysis. */
export async function setChoice(
  userId: string,
  analysisId: string,
  target: SuggestionTarget,
  choice: Choice | null,
): Promise<void> {
  if (!isUuid(analysisId)) return;
  if (target.kind === "bullet" && (!Number.isInteger(target.index) || target.index < 0)) return;
  const db = getDb();
  const [owned] = await db
    .select({ result: analyses.result })
    .from(analyses)
    .where(and(eq(analyses.id, analysisId), eq(analyses.userId, userId)));
  const suggestion =
    target.kind === "summary" ? owned?.result?.summary_rewrite : owned?.result?.bullet_suggestions[target.index];
  if (!suggestion) return;

  // Wording identical to the AI's is stored as null.
  const text = choice?.text?.trim().slice(0, MAX_SUGGESTION_TEXT) || null;
  const values = choice && { decision: choice.decision, editedText: text === suggestion.proposed ? null : text };

  if (target.kind === "summary") {
    const key = eq(summaryDecisions.analysisId, analysisId);
    if (!values) {
      await db.delete(summaryDecisions).where(key);
      return;
    }
    await db
      .insert(summaryDecisions)
      .values({ analysisId, ...values })
      .onConflictDoUpdate({ target: summaryDecisions.analysisId, set: { ...values, updatedAt: new Date() } });
    return;
  }

  const key = and(eq(suggestionDecisions.analysisId, analysisId), eq(suggestionDecisions.suggestionIndex, target.index));
  if (!values) {
    await db.delete(suggestionDecisions).where(key);
    return;
  }
  await db
    .insert(suggestionDecisions)
    .values({ analysisId, suggestionIndex: target.index, ...values })
    .onConflictDoUpdate({
      target: [suggestionDecisions.analysisId, suggestionDecisions.suggestionIndex],
      set: { ...values, updatedAt: new Date() },
    });
}
