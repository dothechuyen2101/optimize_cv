import type { ModelPricing } from "./providers";

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number | null;
  cache_read_input_tokens: number | null;
}

export function estimateCostUsd(pricing: ModelPricing, usage: TokenUsage): number {
  const cost =
    usage.input_tokens * pricing.input +
    usage.output_tokens * pricing.output +
    (usage.cache_creation_input_tokens ?? 0) * pricing.cacheWrite +
    (usage.cache_read_input_tokens ?? 0) * pricing.cacheRead;
  return cost / 1_000_000;
}
