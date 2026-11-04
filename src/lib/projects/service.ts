import "server-only";
import { and, eq, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { analyses, projectImports } from "@/db/schema";
import { GITHUB_PROJECTS_PROMPT } from "@/lib/ai/prompts/github-projects";
import { isUuid } from "@/lib/analysis/service";
import type { Decision } from "@/lib/analysis/types";
import { STALE_RUN_MS } from "@/lib/billing/quota";
import type { GithubAddition } from "@/lib/export/revise";
import { toResumeProject, type ProjectImportResult, type ProjectImportState } from "./types";

// Every function that takes a user id scopes its queries to the user's own analyses.

/** The GitHub projects of the user's own CV analysis; null when the analysis isn't theirs. */
export async function getProjectImport(userId: string, analysisId: string): Promise<ProjectImportState | null> {
  if (!isUuid(analysisId)) return null;
  const [row] = await getDb()
    .select({
      status: projectImports.status,
      source: projectImports.source,
      result: projectImports.result,
      decisions: projectImports.decisions,
      errorCode: projectImports.errorCode,
    })
    .from(analyses)
    .leftJoin(projectImports, eq(projectImports.analysisId, analyses.id))
    .where(and(eq(analyses.id, analysisId), eq(analyses.userId, userId), eq(analyses.status, "completed")));
  if (!row) return null;
  if (!row.status || !row.source) return { status: "none" };
  if (row.status === "completed" && row.result) {
    return { status: "completed", source: row.source, result: row.result, decisions: row.decisions ?? {} };
  }
  if (row.status === "failed") return { status: "failed", source: row.source, errorCode: row.errorCode };
  return { status: "running", source: row.source };
}

/**
 * Takes the slot for generating this analysis's projects. Fails when they exist or another
 * request is generating them. A failed or crashed run can be taken over, with a new link, and
 * so can one that found nothing: it may just have been the wrong account.
 * The caller must have checked that the analysis belongs to the user.
 */
export async function claimProjectImport(analysisId: string, source: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_RUN_MS);
  const promptVersion = GITHUB_PROJECTS_PROMPT.version;
  const claimed = await getDb()
    .insert(projectImports)
    .values({ analysisId, source, promptVersion })
    .onConflictDoUpdate({
      target: projectImports.analysisId,
      set: { status: "running", source, result: null, errorCode: null, promptVersion, createdAt: sql`now()` },
      setWhere: or(
        eq(projectImports.status, "failed"),
        and(eq(projectImports.status, "running"), lt(projectImports.createdAt, staleBefore)),
        and(eq(projectImports.status, "completed"), sql`jsonb_array_length(${projectImports.result} -> 'proposals') = 0`),
      ),
    })
    .returning({ analysisId: projectImports.analysisId });
  return claimed.length > 0;
}

export async function completeProjectImport(analysisId: string, result: ProjectImportResult): Promise<void> {
  await getDb()
    .update(projectImports)
    .set({ status: "completed", result, completedAt: new Date() })
    .where(eq(projectImports.analysisId, analysisId));
}

export async function failProjectImport(analysisId: string, errorCode: string): Promise<void> {
  await getDb()
    .update(projectImports)
    .set({ status: "failed", errorCode })
    .where(eq(projectImports.analysisId, analysisId));
}

/** Saves the user's calls on proposals of their own analysis; null clears a call. */
export async function setProjectDecisions(
  userId: string,
  analysisId: string,
  changes: Record<number, Decision | null>,
): Promise<void> {
  if (!isUuid(analysisId)) return;
  await getDb().transaction(async (tx) => {
    const [row] = await tx
      .select({ result: projectImports.result, decisions: projectImports.decisions })
      .from(projectImports)
      .innerJoin(analyses, eq(analyses.id, projectImports.analysisId))
      .where(and(eq(projectImports.analysisId, analysisId), eq(analyses.userId, userId), eq(projectImports.status, "completed")))
      .for("update", { of: projectImports });
    if (!row?.result) return;

    const decisions = { ...row.decisions };
    for (const [key, decision] of Object.entries(changes)) {
      const index = Number(key);
      if (!Number.isInteger(index) || index < 0 || index >= row.result.proposals.length) continue;
      if (decision === "accepted" || decision === "rejected") decisions[index] = decision;
      else if (decision === null) delete decisions[index];
    }
    await tx.update(projectImports).set({ decisions }).where(eq(projectImports.analysisId, analysisId));
  });
}

/** The accepted proposals as resume projects, for the revised CV. */
export async function acceptedGithubProjects(analysisId: string): Promise<GithubAddition[]> {
  const [row] = await getDb()
    .select({ result: projectImports.result, decisions: projectImports.decisions })
    .from(projectImports)
    .where(and(eq(projectImports.analysisId, analysisId), eq(projectImports.status, "completed")));
  if (!row?.result) return [];
  return row.result.proposals.flatMap((proposal, index) =>
    row.decisions[index] === "accepted" ? [{ index, project: toResumeProject(proposal), skills: proposal.new_skills }] : [],
  );
}
