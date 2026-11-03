import "server-only";
import { and, count, desc, eq, gt, gte, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { analyses, jobDescriptions, portfolioReviews, profiles } from "@/db/schema";
import { PORTFOLIO_REVIEW_PROMPT } from "@/lib/ai/prompts/portfolio-review";
import type { PortfolioReview } from "@/lib/ai/schemas/portfolio";
import { isUuid } from "@/lib/analysis/service";
import { PLAN_PORTFOLIO_LIMITS, STALE_RUN_MS, hasQuotaLeft, quotaWindowStart, type QuotaStatus } from "@/lib/billing/quota";

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type PortfolioInputs = (typeof portfolioReviews.$inferSelect)["sources"];

// Every function takes the signed-in user's id and scopes its queries to it.
// Like analyses, failed reviews don't count against quota; crashed ones stop counting after a while.

async function portfolioQuotaFor(db: Db | Tx, userId: string, now = new Date()): Promise<QuotaStatus> {
  const [profile] = await db.select({ plan: profiles.plan }).from(profiles).where(eq(profiles.id, userId));
  const [{ used }] = await db
    .select({ used: count() })
    .from(portfolioReviews)
    .where(
      and(
        eq(portfolioReviews.userId, userId),
        gte(portfolioReviews.createdAt, quotaWindowStart(now)),
        or(
          eq(portfolioReviews.status, "completed"),
          and(eq(portfolioReviews.status, "running"), gt(portfolioReviews.createdAt, new Date(now.getTime() - STALE_RUN_MS))),
        ),
      ),
    );
  return { used, limit: PLAN_PORTFOLIO_LIMITS[profile?.plan ?? "free"] };
}

export function getPortfolioQuota(userId: string): Promise<QuotaStatus> {
  return portfolioQuotaFor(getDb(), userId);
}

/** Creates a running review on the user's own analysis if they have quota left; null if the analysis isn't theirs. */
export function reservePortfolioReview(
  userId: string,
  analysisId: string,
  sources: PortfolioInputs,
): Promise<{ id: string } | { quota: QuotaStatus } | null> {
  if (!isUuid(analysisId)) return Promise.resolve(null);
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`portfolio:${userId}`}))`);
    const [owned] = await tx
      .select({ id: analyses.id })
      .from(analyses)
      .where(and(eq(analyses.id, analysisId), eq(analyses.userId, userId), eq(analyses.status, "completed")));
    if (!owned) return null;
    const quota = await portfolioQuotaFor(tx, userId);
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
