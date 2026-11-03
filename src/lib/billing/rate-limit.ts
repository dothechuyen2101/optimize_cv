import "server-only";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { aiUsage } from "@/db/schema";

// Quotas cap features per month; this caps bursts, so a script can't run up the AI bill
// within a quota (an interview session alone is up to 20 calls). Counted from ai_usage,
// so it holds across serverless instances. A human practicing hard stays far below it.
export const AI_CALLS_PER_WINDOW = 40;
export const RATE_WINDOW_SECONDS = 10 * 60;

export async function isRateLimited(userId: string): Promise<boolean> {
  const [{ calls }] = await getDb()
    .select({ calls: count() })
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, userId),
        // The database's clock, the one that stamped created_at: app servers' clocks drift.
        gt(aiUsage.createdAt, sql`now() - make_interval(secs => ${RATE_WINDOW_SECONDS})`),
      ),
    );
  return calls >= AI_CALLS_PER_WINDOW;
}
