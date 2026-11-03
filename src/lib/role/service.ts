import "server-only";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { analyses, roleReports } from "@/db/schema";
import { ROLE_ANALYSIS_PROMPT } from "@/lib/ai/prompts/role-analysis";
import type { RoleReport } from "@/lib/ai/schemas/role";
import { isUuid } from "@/lib/analysis/service";
import { STALE_RUN_MS } from "@/lib/billing/quota";

export type RoleReportState =
  | { status: "none" }
  | { status: "running" }
  | { status: "failed"; errorCode: string | null }
  | { status: "completed"; report: RoleReport };

/** The role analysis of the user's own CV analysis; null when the analysis isn't theirs. */
export async function getRoleReport(userId: string, analysisId: string): Promise<RoleReportState | null> {
  if (!isUuid(analysisId)) return null;
  const [row] = await getDb()
    .select({ status: roleReports.status, result: roleReports.result, errorCode: roleReports.errorCode })
    .from(analyses)
    .leftJoin(roleReports, eq(roleReports.analysisId, analyses.id))
    .where(and(eq(analyses.id, analysisId), eq(analyses.userId, userId), eq(analyses.status, "completed")));
  if (!row) return null;
  if (row.status === "completed" && row.result) return { status: "completed", report: row.result };
  if (row.status === "failed") return { status: "failed", errorCode: row.errorCode };
  return row.status ? { status: "running" } : { status: "none" };
}

/**
 * Takes the slot for generating this analysis's role report. Fails when a report exists
 * or another request is generating one; a failed or crashed run can be taken over.
 * The caller must have checked that the analysis belongs to the user.
 */
export async function claimRoleReport(analysisId: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_RUN_MS);
  const claimed = await getDb()
    .insert(roleReports)
    .values({ analysisId, promptVersion: ROLE_ANALYSIS_PROMPT.version })
    .onConflictDoUpdate({
      target: roleReports.analysisId,
      set: { status: "running", errorCode: null, promptVersion: ROLE_ANALYSIS_PROMPT.version, createdAt: sql`now()` },
      setWhere: or(
        eq(roleReports.status, "failed"),
        and(eq(roleReports.status, "running"), lt(roleReports.createdAt, staleBefore)),
      ),
    })
    .returning({ analysisId: roleReports.analysisId });
  return claimed.length > 0;
}

export async function completeRoleReport(analysisId: string, report: RoleReport): Promise<void> {
  await getDb()
    .update(roleReports)
    .set({ status: "completed", result: report, completedAt: new Date() })
    .where(eq(roleReports.analysisId, analysisId));
}

export async function failRoleReport(analysisId: string, errorCode: string): Promise<void> {
  await getDb().update(roleReports).set({ status: "failed", errorCode }).where(eq(roleReports.analysisId, analysisId));
}
