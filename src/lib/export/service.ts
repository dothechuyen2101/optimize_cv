import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { analyses, cvEdits } from "@/db/schema";
import { getAnalysisReport, isUuid } from "@/lib/analysis/service";
import { CV_KEY_PATTERN, MAX_CV_TEXT, buildCvDocument, type CvEdit, type CvEdits } from "./document";
import { reviseResume } from "./revise";

/** The user's own analysis with its suggestions applied, laid out as a CV, plus their hand edits. */
export async function loadCvExport(userId: string, analysisId: string) {
  const found = await getAnalysisReport(userId, analysisId);
  if (!found) return null;

  const rows = await getDb()
    .select({ key: cvEdits.key, base: cvEdits.base, value: cvEdits.value })
    .from(cvEdits)
    .where(eq(cvEdits.analysisId, analysisId));
  const revision = reviseResume(found.report.resume, found.report.analysis, found.choices);
  const edits: CvEdits = Object.fromEntries(rows.map(({ key, base, value }) => [key, { base, value }]));
  return { report: found.report, revision, document: buildCvDocument(revision), edits };
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
