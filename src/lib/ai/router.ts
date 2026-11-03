import type { ModelTier } from "./providers";

export type StepName =
  | "parse_cv"
  | "parse_cv_scan"
  | "parse_jd"
  | "analyze_match"
  | "role_analysis"
  | "interview_turn"
  | "interview_report";

export interface StepConfig {
  tier: ModelTier;
  /** Ignored by models that don't support effort. */
  effort: "low" | "medium" | "high";
  maxTokens: number;
}

// Fast tier for extraction, strong tier for judgment and writing. Move a step to
// another tier only after comparing quality and cost on the eval set.
export const STEP_CONFIG: Record<StepName, StepConfig> = {
  parse_cv: { tier: "fast", effort: "low", maxTokens: 12000 },
  // PDFs without a text layer: the strong tier reads digits and diacritics off images far more reliably.
  parse_cv_scan: { tier: "strong", effort: "medium", maxTokens: 12000 },
  parse_jd: { tier: "fast", effort: "low", maxTokens: 6000 },
  analyze_match: { tier: "strong", effort: "medium", maxTokens: 16000 },
  role_analysis: { tier: "strong", effort: "medium", maxTokens: 12000 },
  // A chat turn: latency matters more than depth.
  interview_turn: { tier: "fast", effort: "low", maxTokens: 2000 },
  interview_report: { tier: "strong", effort: "medium", maxTokens: 8000 },
};
