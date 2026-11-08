import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { analyses, jobDescriptions, portfolioReviews } from "@/db/schema";
import { PORTFOLIO_REVIEW_PROMPT } from "@/lib/ai/prompts/portfolio-review";
import type { PortfolioReview } from "@/lib/ai/schemas/portfolio";
import { isUuid } from "@/lib/analysis/service";
import { lockQuota, quotaFor } from "@/lib/billing/limits";
import { hasQuotaLeft, type QuotaStatus } from "@/lib/billing/quota";

export type PortfolioInputs = (typeof portfolioReviews.$inferSelect)["sources"];

// Every function takes the signed-in user's id and scopes its queries to it.
// Reviews share the monthly quota with analyses and interviews (see lib/billing/limits.ts):
// failed ones don't count, crashed ones stop counting after a while.

/** Creates a running review on the user's own analysis if they have quota left; null if the analysis isn't theirs. */
export function reservePortfolioReview(
  userId: string,
  analysisId: string,
  sources: PortfolioInputs,
): Promise<{ id: string } | { quota: QuotaStatus } | null> {
  if (!isUuid(analysisId)) return Promise.resolve(null);
  return getDb().transaction(async (tx) => {
    await lockQuota(tx, userId);
    const [owned] = await tx
      .select({ id: analyses.id })
      .from(analyses)
      .where(and(eq(analyses.id, analysisId), eq(analyses.userId, userId), eq(analyses.status, "completed")));
    if (!owned) return null;
    const quota = await quotaFor(tx, userId);
    if (!hasQuotaLeft(quota)) return { quota };
    const [row] = await tx
      .insert(portfolioReviews)
      .values({ userId, analysisId, sources, promptVersion: PORTFOLIO_REVIEW_PROMPT.version })
      .returning({ id: portfolioReviews.id });
    return { id: row.id };
  });
}

export async function completePortfolioReview(id: string, result: PortfolioReview): Promise<void> {
  await getDb()
    .update(portfolioReviews)
    .set({ status: "completed", result, completedAt: new Date() })
    .where(eq(portfolioReviews.id, id));
}

export async function failPortfolioReview(id: string, errorCode: string): Promise<void> {
  await getDb().update(portfolioReviews).set({ status: "failed", errorCode }).where(eq(portfolioReviews.id, id));
}

export interface StoredPortfolioReview {
  id: string;
  analysisId: string;
  sources: PortfolioInputs;
  result: PortfolioReview;
  createdAt: Date;
  jobTitle: string | null;
  company: string | null;
}

export async function getPortfolioReview(userId: string, id: string): Promise<StoredPortfolioReview | null> {
  if (!isUuid(id)) return null;
  const [row] = await getDb()
    .select({
      id: portfolioReviews.id,
      analysisId: portfolioReviews.analysisId,
      sources: portfolioReviews.sources,
      result: portfolioReviews.result,
      createdAt: portfolioReviews.createdAt,
      job: jobDescriptions.parsed,
    })
    .from(portfolioReviews)
    .innerJoin(analyses, eq(analyses.id, portfolioReviews.analysisId))
    .leftJoin(jobDescriptions, eq(jobDescriptions.id, analyses.jobDescriptionId))
    .where(and(eq(portfolioReviews.id, id), eq(portfolioReviews.userId, userId), eq(portfolioReviews.status, "completed")));
  if (!row?.result) return null;
  const { job, result, ...rest } = row;
  return { ...rest, result, jobTitle: job?.title ?? null, company: job?.company ?? null };
}

/** The user's completed reviews for one analysis, newest first. */
export async function listPortfolioReviews(userId: string, analysisId: string) {
  if (!isUuid(analysisId)) return [];
  const rows = await getDb()
    .select({ id: portfolioReviews.id, createdAt: portfolioReviews.createdAt, sources: portfolioReviews.sources, result: portfolioReviews.result })
    .from(portfolioReviews)
    .where(
      and(
        eq(portfolioReviews.userId, userId),
        eq(portfolioReviews.analysisId, analysisId),
        eq(portfolioReviews.status, "completed"),
      ),
    )
    .orderBy(desc(portfolioReviews.createdAt));
  return rows.map(({ result, ...row }) => ({ ...row, overall: result?.overall ?? null }));
}
