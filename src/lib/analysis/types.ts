import type { Analysis } from "@/lib/ai/schemas/analysis";
import type { Job } from "@/lib/ai/schemas/job";
import type { Resume } from "@/lib/ai/schemas/resume";
import type { AtsResult, Market } from "@/lib/ats/score";

/** Steps of an analysis as the form shows them; "github" runs after it when the user gave a link. */
export type AnalysisStage = "parsing" | "scoring" | "analyzing" | "github";

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
  /** The analysis whose revised CV this one re-evaluates. */
  previous: { id: string; overall: number } | null;
}

/** The JD of one of the user's analyses, to analyze another CV (e.g. a revised one) against. */
export interface SavedJob {
  /** The analysis it comes from; a new analysis with the same JD is compared with it. */
  analysisId: string;
  jd: string;
  market: "auto" | "vn" | "international";
  title: string | null;
  company: string | null;
}

export type Decision = "accepted" | "rejected";

/** The user's call on one suggestion; `text` is their own wording of it, null to keep the AI's. */
export interface Choice {
  decision: Decision;
  text: string | null;
}

export interface Choices {
  /** Keyed by position in analysis.bullet_suggestions. */
  bullets: Record<number, Choice>;
  summary: Choice | null;
}

export type SuggestionTarget = { kind: "bullet"; index: number } | { kind: "summary" };

export const MAX_SUGGESTION_TEXT = 2000;

/** Square-bracket gaps such as "[X%]" that the AI leaves for the user to fill. */
const PLACEHOLDER = /\[[^[\]\n]{1,40}\]/;

export function findPlaceholders(text: string): string[] {
  return text.match(new RegExp(PLACEHOLDER, "g")) ?? [];
}

/** Splits text so that its placeholders land at the odd indexes. */
export function splitPlaceholders(text: string): string[] {
  return text.split(new RegExp(`(${PLACEHOLDER.source})`));
}

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
  | "too_many_requests"
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
