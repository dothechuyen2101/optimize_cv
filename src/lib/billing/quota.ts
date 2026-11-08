export type Plan = "free" | "pro";

/**
 * Uses per calendar month (UTC), shared by CV analyses, practice interviews and portfolio
 * reviews: a free account gets one of any of them. null means unlimited.
 */
export const PLAN_MONTHLY_LIMITS: Record<Plan, number | null> = {
  free: 1,
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

/** Parses an email list from the environment: separated by commas, semicolons or whitespace; case-insensitive. */
export function parseEmailList(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(/[\s,;]+/)
      .map((email) => email.toLowerCase())
      .filter((email) => email.includes("@")),
  );
}
