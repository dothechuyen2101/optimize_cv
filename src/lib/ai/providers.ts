import "server-only";

// USD per million tokens, used only for internal cost tracking.
export interface ModelPricing {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface ModelSpec {
  id: string;
  pricing: ModelPricing;
  /** Accepts `output_config.effort` (Claude 4.6+ models). */
  effort: boolean;
  /** Accepts the server-side `fallbacks` parameter for refusals. */
  refusalFallback: boolean;
}

/** Steps ask for a tier; each provider decides which model serves it. */
export type ModelTier = "fast" | "strong";

export type ProviderName = "anthropic" | "wellflow";

export interface ProviderConfig {
  name: ProviderName;
  /** Undefined means the SDK default (api.anthropic.com). */
  baseURL: string | undefined;
  apiKeyEnv: "ANTHROPIC_API_KEY" | "WELLFLOW_API_KEY";
  /** Passes `output_config.format` through. Without it, results come back via a tool call. */
  structuredOutputs: boolean;
  models: Record<ModelTier, ModelSpec>;
}

const PROVIDERS: Record<ProviderName, ProviderConfig> = {
  anthropic: {
    name: "anthropic",
    baseURL: undefined,
    apiKeyEnv: "ANTHROPIC_API_KEY",
    structuredOutputs: true,
    models: {
      fast: {
        id: "claude-haiku-5-5",
        pricing: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
        effort: true,
        refusalFallback: false,
      },
      strong: {
        id: "claude-opus-5-5",
        pricing: { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
        effort: true,
        refusalFallback: true,
      },
    },
  },
  // Anthropic-format endpoint of https://wellflow.dev (prepaid, one key for many vendors).
  // Model ids and prices come from its Models page; ids can differ from Anthropic's.
  wellflow: {
    name: "wellflow",
    baseURL: "https://api.wellflow.dev",
    apiKeyEnv: "WELLFLOW_API_KEY",
    // Verified 2026-11-02: output_config.format is dropped (the model answers in free
    // text), while tool calls come back intact.
    structuredOutputs: false,
    models: {
      fast: {
        id: "claude-haiku-5.5",
        // Not on the Models page we've seen; Anthropic list price as an upper bound.
        pricing: { input: 0.1, output: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
        effort: true,
        refusalFallback: false,
      },
      strong: {
        id: "claude-opus-5-5",
        pricing: { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 },
        effort: true,
        // Not verified to pass through the gateway.
        refusalFallback: false,
      },
    },
  },
};

/** The AI provider is misconfigured: unknown AI_PROVIDER or missing credentials. */
export class AIConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AIConfigError";
  }
}

export function getProvider(): ProviderConfig {
  const name = process.env.AI_PROVIDER || "anthropic";
  if (!Object.hasOwn(PROVIDERS, name)) {
    throw new AIConfigError(`AI_PROVIDER must be one of: ${Object.keys(PROVIDERS).join(", ")}`);
  }
  return PROVIDERS[name as ProviderName];
}

export function providerApiKey(provider: ProviderConfig): string | undefined {
  return process.env[provider.apiKeyEnv] || undefined;
}
