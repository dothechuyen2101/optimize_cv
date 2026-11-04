import "server-only";
import { eq } from "drizzle-orm";
import { authUsers } from "drizzle-orm/supabase";
import { getDb } from "@/db";
import { profiles } from "@/db/schema";
import { PLAN_ANALYSIS_LIMITS, PLAN_INTERVIEW_LIMITS, PLAN_PORTFOLIO_LIMITS, parseEmailList } from "./quota";

type Db = ReturnType<typeof getDb>;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const PLAN_LIMITS = { analysis: PLAN_ANALYSIS_LIMITS, interview: PLAN_INTERVIEW_LIMITS, portfolio: PLAN_PORTFOLIO_LIMITS };
export type QuotaFeature = keyof typeof PLAN_LIMITS;

// Accounts listed in UNLIMITED_EMAILS (the team, testers) skip every monthly quota and the AI
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

/** The user's monthly limit for a feature: by plan, or null (none) for an unlimited account. */
export async function monthlyLimit(db: Db | Tx, userId: string, feature: QuotaFeature): Promise<number | null> {
  const row = await account(db, userId);
  return isUnlimited(row) ? null : PLAN_LIMITS[feature][row?.plan ?? "free"];
}

export async function isUnlimitedUser(userId: string): Promise<boolean> {
  if (parseEmailList(process.env.UNLIMITED_EMAILS).size === 0) return false;
  return isUnlimited(await account(getDb(), userId));
}
