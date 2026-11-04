import "server-only";
import { and, asc, count, desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { analyses, interviewSessions, interviewTurns, jobDescriptions, resumeVersions } from "@/db/schema";
import type { Locale } from "@/i18n/config";
import { INTERVIEW_REPORT_PROMPT, INTERVIEW_TURN_PROMPT } from "@/lib/ai/prompts/interview";
import type { AnswerFeedback, InterviewReport } from "@/lib/ai/schemas/interview";
import type { Job } from "@/lib/ai/schemas/job";
import type { Resume } from "@/lib/ai/schemas/resume";
import type { InterviewSettings, TranscriptEntry } from "@/lib/ai/steps/interview";
import { isUuid } from "@/lib/analysis/service";
import { monthlyLimit } from "@/lib/billing/limits";
import { hasQuotaLeft, quotaWindowStart, type QuotaStatus } from "@/lib/billing/quota";

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// Every function takes the signed-in user's id and scopes its queries to it.

async function interviewQuotaFor(db: Db | Tx, userId: string, now = new Date()): Promise<QuotaStatus> {
  const [{ used }] = await db
    .select({ used: count() })
    .from(interviewSessions)
    .where(and(eq(interviewSessions.userId, userId), gte(interviewSessions.createdAt, quotaWindowStart(now))));
  return { used, limit: await monthlyLimit(db, userId, "interview") };
}

export function getInterviewQuota(userId: string): Promise<QuotaStatus> {
  return interviewQuotaFor(getDb(), userId);
}

/** Creates a session on the user's own analysis if they have quota left; atomic per user like analyses. */
export function createInterviewSession(
  userId: string,
  analysisId: string,
  settings: InterviewSettings,
): Promise<{ id: string } | { quota: QuotaStatus } | null> {
  if (!isUuid(analysisId)) return Promise.resolve(null);
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`interview:${userId}`}))`);
    const [owned] = await tx
      .select({ id: analyses.id })
      .from(analyses)
      .where(and(eq(analyses.id, analysisId), eq(analyses.userId, userId), eq(analyses.status, "completed")));
    if (!owned) return null;
    const quota = await interviewQuotaFor(tx, userId);
    if (!hasQuotaLeft(quota)) return { quota };
    const [row] = await tx
      .insert(interviewSessions)
      .values({
        userId,
        analysisId,
        ...settings,
        promptVersions: [INTERVIEW_TURN_PROMPT.version, INTERVIEW_REPORT_PROMPT.version],
      })
      .returning({ id: interviewSessions.id });
    return { id: row.id };
  });
}

/** Removes a session whose first question couldn't be generated, so it doesn't use quota. */
export async function discardInterviewSession(userId: string, sessionId: string): Promise<void> {
  await getDb()
    .delete(interviewSessions)
    .where(and(eq(interviewSessions.id, sessionId), eq(interviewSessions.userId, userId)));
}

export interface StoredTurn extends TranscriptEntry {
  position: number;
  feedback: AnswerFeedback | null;
}

export interface LoadedInterview {
  id: string;
  analysisId: string;
  settings: InterviewSettings;
  status: "active" | "completed";
  report: InterviewReport | null;
  createdAt: Date;
  job: Job;
  resume: Resume;
  turns: StoredTurn[];
}

export async function loadInterview(userId: string, sessionId: string): Promise<LoadedInterview | null> {
  if (!isUuid(sessionId)) return null;
  const db = getDb();
  const [row] = await db
    .select({
      id: interviewSessions.id,
      analysisId: interviewSessions.analysisId,
      type: interviewSessions.type,
      difficulty: interviewSessions.difficulty,
      language: interviewSessions.language,
      feedback: interviewSessions.feedback,
      status: interviewSessions.status,
      report: interviewSessions.report,
      createdAt: interviewSessions.createdAt,
      job: jobDescriptions.parsed,
      resume: resumeVersions.parsed,
    })
    .from(interviewSessions)
    .innerJoin(analyses, eq(analyses.id, interviewSessions.analysisId))
    .innerJoin(jobDescriptions, eq(jobDescriptions.id, analyses.jobDescriptionId))
    .innerJoin(resumeVersions, eq(resumeVersions.id, analyses.resumeVersionId))
    .where(and(eq(interviewSessions.id, sessionId), eq(interviewSessions.userId, userId)));
  if (!row) return null;

  const turns = await db
    .select({
      position: interviewTurns.position,
      role: interviewTurns.role,
      kind: interviewTurns.kind,
      content: interviewTurns.content,
      feedback: interviewTurns.feedback,
    })
    .from(interviewTurns)
    .where(eq(interviewTurns.sessionId, sessionId))
    .orderBy(asc(interviewTurns.position));

  const { type, difficulty, language, feedback, ...rest } = row;
  return {
    ...rest,
    settings: { type, difficulty, language: language as Locale, feedback },
    turns: turns.map((turn) => ({ ...turn, kind: turn.kind ?? undefined })),
  };
}

/** Appends turns after the last one. Positions are the primary key, so a concurrent append fails instead of interleaving. */
export async function appendTurns(
  sessionId: string,
  after: number,
  turns: { role: "interviewer" | "candidate"; kind?: TranscriptEntry["kind"]; content: string; feedback?: AnswerFeedback | null }[],
): Promise<StoredTurn[]> {
  const rows = turns.map((turn, i) => ({
    sessionId,
    position: after + 1 + i,
    role: turn.role,
    kind: turn.kind ?? null,
    content: turn.content,
    feedback: turn.feedback ?? null,
  }));
  await getDb().insert(interviewTurns).values(rows);
  return rows.map(({ position, role, kind, content, feedback }) => ({
    position,
    role,
    kind: kind ?? undefined,
    content,
    feedback,
  }));
}

export async function completeInterview(sessionId: string, report: InterviewReport): Promise<void> {
  await getDb()
    .update(interviewSessions)
    .set({ status: "completed", report, completedAt: new Date() })
    .where(eq(interviewSessions.id, sessionId));
}

export interface InterviewListItem {
  id: string;
  createdAt: Date;
  status: "active" | "completed";
  type: InterviewSettings["type"];
  difficulty: InterviewSettings["difficulty"];
  jobTitle: string | null;
  company: string | null;
  overall: number | null;
}

export async function listInterviews(userId: string, analysisId?: string, limit = 50): Promise<InterviewListItem[]> {
  const rows = await getDb()
    .select({
      id: interviewSessions.id,
      createdAt: interviewSessions.createdAt,
      status: interviewSessions.status,
      type: interviewSessions.type,
      difficulty: interviewSessions.difficulty,
      report: interviewSessions.report,
      job: jobDescriptions.parsed,
    })
    .from(interviewSessions)
    .innerJoin(analyses, eq(analyses.id, interviewSessions.analysisId))
    .leftJoin(jobDescriptions, eq(jobDescriptions.id, analyses.jobDescriptionId))
    .where(
      and(
        eq(interviewSessions.userId, userId),
        analysisId && isUuid(analysisId) ? eq(interviewSessions.analysisId, analysisId) : undefined,
      ),
    )
    .orderBy(desc(interviewSessions.createdAt))
    .limit(limit);
  return rows.map(({ report, job, ...row }) => ({
    ...row,
    jobTitle: job?.title ?? null,
    company: job?.company ?? null,
    overall: report?.overall ?? null,
  }));
}
