import Anthropic from "@anthropic-ai/sdk";
import type { AnalysisErrorCode } from "@/lib/analysis/types";
import { AIConfigError, getProvider, providerApiKey } from "./providers";
import { AIStepError } from "./run-step";

/** Maps a failed AI call to the code the UI explains. */
export function aiErrorCode(error: unknown): AnalysisErrorCode {
  if (error instanceof AIStepError) {
    return ({ refusal: "ai_refusal", truncated: "ai_truncated", invalid_output: "ai_invalid_output" } as const)[
      error.reason
    ];
  }
  if (
    error instanceof AIConfigError ||
    error instanceof Anthropic.AuthenticationError ||
    error instanceof Anthropic.PermissionDeniedError
  ) {
    return "ai_auth";
  }
  if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
    return "ai_rate_limited";
  }
  // With no credentials at all the SDK throws a plain Error before sending anything.
  if (!(error instanceof Anthropic.APIError) && !providerApiKey(getProvider()) && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return "ai_auth";
  }
  return "server";
}
