import type { ModelTier } from "./providers";

export type StepName = "parse_cv" | "parse_jd" | "analyze_match";

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
  parse_jd: { tier: "fast", effort: "low", maxTokens: 6000 },
  analyze_match: { tier: "strong", effort: "medium", maxTokens: 16000 },
};
