import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { analyses, cvEdits, jobDescriptions } from "@/db/schema";
import type { Job } from "@/lib/ai/schemas/job";
import type { Resume } from "@/lib/ai/schemas/resume";
import { sha256Hex } from "@/lib/analysis/keys";
import type { Stored } from "@/lib/analysis/run-analysis";
import { getAnalysisReport, isUuid } from "@/lib/analysis/service";
import { scoreAts, type AtsResult, type Market } from "@/lib/ats/score";
import { acceptedGithubProjects } from "@/lib/projects/service";
import {
  CV_KEY_PATTERN,
  MAX_CV_TEXT,
  applyCvEdits,
  buildCvDocument,
  resumeFromDocument,
  type CvEdit,
  type CvEdits,
} from "./document";
import { reviseResume } from "./revise";

/** The user's own analysis with its suggestions and GitHub projects applied, laid out as a CV, plus their hand edits. */
export async function loadCvExport(userId: string, analysisId: string) {
  const found = await getAnalysisReport(userId, analysisId);
  if (!found) return null;

  const [rows, github] = await Promise.all([
    getDb()
      .select({ key: cvEdits.key, base: cvEdits.base, value: cvEdits.value })
      .from(cvEdits)
      .where(eq(cvEdits.analysisId, analysisId)),
    acceptedGithubProjects(analysisId),
  ]);
  const revision = reviseResume(found.report.resume, found.report.analysis, found.choices, github);
  const edits: CvEdits = Object.fromEntries(rows.map(({ key, base, value }) => [key, { base, value }]));
  return { report: found.report, revision, document: buildCvDocument(revision), edits };
}

type CvExport = NonNullable<Awaited<ReturnType<typeof loadCvExport>>>;

/** The CV as the preview shows it and the downloads contain it, as a structured resume. */
function revisedResume(cv: CvExport): Resume {
  return resumeFromDocument(cv.revision.resume, applyCvEdits(cv.document, cv.edits));
}

/** Scores the revised CV against the same JD and market. Code only, so it costs nothing. */
export async function rescoreRevisedCv(
  userId: string,
  analysisId: string,
): Promise<{ before: AtsResult; after: AtsResult } | null> {
  const cv = await loadCvExport(userId, analysisId);
  if (!cv) return null;
  return { before: cv.report.ats, after: scoreAts(revisedResume(cv), cv.report.job, cv.report.market) };
}

export interface ReanalysisInputs {
  resume: Resume;
  /** Identifies this exact revision, for the analysis cache. */
  resumeHash: string;
  /** The resume version the earlier analysis read; the revision becomes its next version. */
  fromVersionId: string;
  job: Stored<Job>;
  jdHash: string;
  market: Market;
}

/** Re-analyzing the revised CV reuses the earlier analysis's JD and market, so only the analysis step runs. */
export async function loadReanalysisInputs(userId: string, analysisId: string): Promise<ReanalysisInputs | null> {
  const cv = await loadCvExport(userId, analysisId);
  if (!cv) return null;
  const [row] = await getDb()
    .select({
      resumeVersionId: analyses.resumeVersionId,
      jobDescriptionId: analyses.jobDescriptionId,
      jdHash: jobDescriptions.contentHash,
    })
    .from(analyses)
    .innerJoin(jobDescriptions, eq(jobDescriptions.id, analyses.jobDescriptionId))
    .where(and(eq(analyses.id, analysisId), eq(analyses.userId, userId)));
  if (!row?.resumeVersionId || !row.jobDescriptionId) return null;

  const resume = revisedResume(cv);
  return {
    resume,
    resumeHash: sha256Hex(JSON.stringify(resume)),
    fromVersionId: row.resumeVersionId,
    job: { id: row.jobDescriptionId, value: cv.report.job },
    jdHash: row.jdHash,
    market: cv.report.market,
  };
}

/** Saves a hand edit on the user's own analysis, or removes it when `edit` is null or changes nothing. */
export async function setCvEdit(userId: string, analysisId: string, key: string, edit: CvEdit | null): Promise<boolean> {
  if (!isUuid(analysisId) || !CV_KEY_PATTERN.test(key)) return false;
  if (edit && (edit.base.length > MAX_CV_TEXT || edit.value.length > MAX_CV_TEXT)) return false;
  const db = getDb();
  const [owned] = await db
    .select({ id: analyses.id })
    .from(analyses)
    .where(and(eq(analyses.id, analysisId), eq(analyses.userId, userId)));
  if (!owned) return false;

  const value = edit?.value.trim();
  if (!edit || value === edit.base) {
    await db.delete(cvEdits).where(and(eq(cvEdits.analysisId, analysisId), eq(cvEdits.key, key)));
    return true;
  }
  const values = { base: edit.base, value: value ?? "", updatedAt: new Date() };
  await db
    .insert(cvEdits)
    .values({ analysisId, key, ...values })
    .onConflictDoUpdate({ target: [cvEdits.analysisId, cvEdits.key], set: values });
  return true;
}
