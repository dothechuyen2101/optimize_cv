export type Plan = "free" | "pro";

/** Analyses per calendar month (UTC); null means unlimited. */
export const PLAN_ANALYSIS_LIMITS: Record<Plan, number | null> = {
  free: 3,
  pro: null,
};

/** Practice interview sessions per calendar month (UTC). */
export const PLAN_INTERVIEW_LIMITS: Record<Plan, number | null> = {
  free: 2,
  pro: null,
};

/** A run still "running" after this long crashed; it stops holding quota. */
export const STALE_RUN_MS = 15 * 60 * 1000;

export function quotaWindowStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface QuotaStatus {
  used: number;
  limit: number | null;
}

export function hasQuotaLeft({ used, limit }: QuotaStatus): boolean {
  return limit === null || used < limit;
}
