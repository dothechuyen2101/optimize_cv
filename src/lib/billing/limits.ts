import "server-only";
import { and, eq, gt, gte, or, sql } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import { getDb } from "@/db";
import { analyses, interviewSessions, portfolioReviews, profiles } from "@/db/schema";
import { PLAN_MONTHLY_LIMITS, STALE_RUN_MS, parseEmailList, quotaWindowStart, type QuotaStatus } from "./quota";

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

// Accounts listed in UNLIMITED_EMAILS (the team, testers) skip the monthly quota and the AI
// rate limit. Only a confirmed address counts: signing up with a listed email you don't own
// gives nothing, and Supabase changes an account's email only after the new one is confirmed.

async function account(db: Db | Tx, userId: string) {
  const [row] = await db
    .select({ plan: profiles.plan, email: authUsers.email, emailConfirmedAt: authUsers.emailConfirmedAt })
    .from(authUsers)
    .leftJoin(profiles, eq(profiles.id, authUsers.id))
    .where(eq(authUsers.id, userId));
  return row;
}

function isUnlimited(row: Awaited<ReturnType<typeof account>> | undefined): boolean {
  if (!row?.email || !row.emailConfirmedAt) return false;
  return parseEmailList(process.env.UNLIMITED_EMAILS).has(row.email.toLowerCase());
}

/** The user's monthly limit: by plan, or null (none) for an unlimited account. */
async function monthlyLimit(db: Db | Tx, userId: string): Promise<number | null> {
  const row = await account(db, userId);
  return isUnlimited(row) ? null : PLAN_MONTHLY_LIMITS[row?.plan ?? "free"];
}

export async function isUnlimitedUser(userId: string): Promise<boolean> {
  if (parseEmailList(process.env.UNLIMITED_EMAILS).size === 0) return false;
  return isUnlimited(await account(getDb(), userId));
}

/** What used the shared monthly quota, by feature. */
export interface MonthlyUsage {
  analysis: number;
  interview: number;
  portfolio: number;
}

/**
 * Analyses and portfolio reviews count once completed or while still running (failed ones
 * don't, crashed ones stop after STALE_RUN_MS); interview sessions count from creation (one
 * whose first question fails is deleted).
 */
async function monthlyUsage(db: Db | Tx, userId: string, now: Date): Promise<MonthlyUsage> {
  const since = quotaWindowStart(now);
  const fresh = new Date(now.getTime() - STALE_RUN_MS);
  // One after another: a transaction runs on a single connection anyway.
  const analysis = await db.$count(
    analyses,
    and(
      eq(analyses.userId, userId),
      gte(analyses.createdAt, since),
      or(eq(analyses.status, "completed"), and(eq(analyses.status, "running"), gt(analyses.createdAt, fresh))),
    ),
  );
  const interview = await db.$count(
    interviewSessions,
    and(eq(interviewSessions.userId, userId), gte(interviewSessions.createdAt, since)),
  );
  const portfolio = await db.$count(
    portfolioReviews,
    and(
      eq(portfolioReviews.userId, userId),
      gte(portfolioReviews.createdAt, since),
      or(
        eq(portfolioReviews.status, "completed"),
        and(eq(portfolioReviews.status, "running"), gt(portfolioReviews.createdAt, fresh)),
      ),
    ),
  );
  return { analysis, interview, portfolio };
}

async function quotaWithUsage(db: Db | Tx, userId: string, now = new Date()) {
  const usage = await monthlyUsage(db, userId, now);
  const quota: QuotaStatus = {
    used: usage.analysis + usage.interview + usage.portfolio,
    limit: await monthlyLimit(db, userId),
  };
  return { quota, usage };
}

/** This month's uses across all three features, against the user's shared limit. */
export async function quotaFor(db: Db | Tx, userId: string): Promise<QuotaStatus> {
  return (await quotaWithUsage(db, userId)).quota;
}

export function getQuota(userId: string): Promise<QuotaStatus> {
  return quotaFor(getDb(), userId);
}

/** The quota plus what used it, for the account page. */
export function getQuotaWithUsage(userId: string): Promise<{ quota: QuotaStatus; usage: MonthlyUsage }> {
  return quotaWithUsage(getDb(), userId);
}

/**
 * Every reservation (analysis, interview, portfolio review) takes this per-user lock before
 * checking the quota, so the check and the insert are atomic across features: parallel
 * requests, even for different features, can't overspend the shared quota.
 */
export async function lockQuota(tx: Tx, userId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`quota:${userId}`}))`);
}
