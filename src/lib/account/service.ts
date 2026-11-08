import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import { getDb } from "@/db";
import {
  analyses,
  cvEdits,
  interviewSessions,
  interviewTurns,
  jobDescriptions,
  portfolioReviews,
  projectImports,
  profiles,
  resumeVersions,
  roleReports,
  suggestionDecisions,
  summaryDecisions,
} from "@/db/schema";
import { getQuotaWithUsage, isUnlimitedUser } from "@/lib/billing/limits";

export async function accountOverview(userId: string) {
  const [[profile], unlimited, { quota, usage }] = await Promise.all([
    getDb().select({ plan: profiles.plan, createdAt: profiles.createdAt }).from(profiles).where(eq(profiles.id, userId)),
    isUnlimitedUser(userId),
    getQuotaWithUsage(userId),
  ]);
  return { plan: unlimited ? ("unlimited" as const) : (profile?.plan ?? "free"), quota, usage };
}

/** Everything stored about the user, for the right of access (Decree 13/2023, GDPR art. 15). */
export async function exportAccountData(userId: string, email: string | null) {
  const db = getDb();
  const [[profile], analysisRows, sessions, reviews] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, userId)),
    db
      .select({
        id: analyses.id,
        createdAt: analyses.createdAt,
        status: analyses.status,
        market: analyses.market,
        uiLocale: analyses.uiLocale,
        parentId: analyses.parentId,
        resume: resumeVersions.parsed,
        jobText: jobDescriptions.rawText,
        job: jobDescriptions.parsed,
        ats: analyses.ats,
        result: analyses.result,
      })
      .from(analyses)
      .leftJoin(resumeVersions, eq(resumeVersions.id, analyses.resumeVersionId))
      .leftJoin(jobDescriptions, eq(jobDescriptions.id, analyses.jobDescriptionId))
      .where(eq(analyses.userId, userId))
      .orderBy(asc(analyses.createdAt)),
    db.select().from(interviewSessions).where(eq(interviewSessions.userId, userId)).orderBy(asc(interviewSessions.createdAt)),
    db.select().from(portfolioReviews).where(eq(portfolioReviews.userId, userId)).orderBy(asc(portfolioReviews.createdAt)),
  ]);

  const analysisIds = analysisRows.map((row) => row.id);
  const sessionIds = sessions.map((session) => session.id);
  const [decisions, summaries, edits, roles, githubProjects, turns] = await Promise.all([
    analysisIds.length ? db.select().from(suggestionDecisions).where(inArray(suggestionDecisions.analysisId, analysisIds)) : [],
    analysisIds.length ? db.select().from(summaryDecisions).where(inArray(summaryDecisions.analysisId, analysisIds)) : [],
    analysisIds.length ? db.select().from(cvEdits).where(inArray(cvEdits.analysisId, analysisIds)) : [],
    analysisIds.length ? db.select().from(roleReports).where(inArray(roleReports.analysisId, analysisIds)) : [],
    analysisIds.length ? db.select().from(projectImports).where(inArray(projectImports.analysisId, analysisIds)) : [],
    sessionIds.length
      ? db.select().from(interviewTurns).where(inArray(interviewTurns.sessionId, sessionIds)).orderBy(asc(interviewTurns.position))
      : [],
  ]);
  const of = <T extends { analysisId: string }>(rows: T[], id: string) => rows.filter((row) => row.analysisId === id);

  return {
    exported_at: new Date().toISOString(),
    account: { id: userId, email, plan: profile?.plan, locale: profile?.locale, created_at: profile?.createdAt },
    analyses: analysisRows.map((row) => ({
      ...row,
      suggestion_decisions: of(decisions, row.id),
      summary_decision: of(summaries, row.id)[0] ?? null,
      cv_edits: of(edits, row.id),
      role_report: of(roles, row.id)[0] ?? null,
      github_projects: of(githubProjects, row.id)[0] ?? null,
    })),
    interviews: sessions.map((session) => ({ ...session, turns: turns.filter((turn) => turn.sessionId === session.id) })),
    portfolio_reviews: reviews,
  };
}

/**
 * Deletes the user's Supabase Auth account. Every table they own references it through
 * profiles with ON DELETE CASCADE, so their CVs, analyses, interviews and reviews go with it;
 * ai_usage keeps anonymous cost rows (user_id set null), and shared JD rows stay.
 */
export async function deleteAccount(userId: string): Promise<void> {
  await getDb().delete(authUsers).where(eq(authUsers.id, userId));
}
