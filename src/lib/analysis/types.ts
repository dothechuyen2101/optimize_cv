import type { Analysis } from "@/lib/ai/schemas/analysis";
import type { Job } from "@/lib/ai/schemas/job";
import type { Resume } from "@/lib/ai/schemas/resume";
import type { AtsResult, Market } from "@/lib/ats/score";

export type AnalysisStage = "parsing" | "scoring" | "analyzing";

/** A completed analysis as the result page shows it. */
export interface AnalysisReport {
  id: string;
  resume: Resume;
  job: Job;
  market: Market;
  ats: AtsResult;
  analysis: Analysis;
  /** Estimated AI spend recorded for this analysis. */
  costUsd: number;
}

export type Decision = "accepted" | "rejected";

export type AnalysisErrorCode =
  | "missing_file"
  | "file_type"
  | "file_too_large"
  | "empty_document"
  | "jd_too_short"
  | "jd_too_long"
  | "invalid_request"
  | "unauthorized"
  | "quota_exceeded"
  | "ai_auth"
  | "ai_rate_limited"
  | "ai_refusal"
  | "ai_truncated"
  | "ai_invalid_output"
  | "server";

/** One line of the NDJSON stream returned by POST /api/analyze. */
export type AnalysisEvent =
  | { type: "stage"; stage: AnalysisStage }
  | { type: "result"; analysisId: string }
  | { type: "error"; code: AnalysisErrorCode };

export const JD_MIN_CHARS = 200;
export const JD_MAX_CHARS = 20_000;
