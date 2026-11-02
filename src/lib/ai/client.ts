import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AIConfigError, getProvider, providerApiKey } from "./providers";

let client: Anthropic | undefined;

/**
 * The only place the app constructs an AI client. AI_PROVIDER picks the
 * endpoint, credentials and model ids (see providers.ts).
 */
export function getAnthropic(): Anthropic {
  if (client) return client;

  const provider = getProvider();
  const apiKey = providerApiKey(provider);
  // A gateway must never fall back to ANTHROPIC_* credentials from the environment,
  // or the SDK would send them to a third party.
  if (provider.baseURL && !apiKey) {
    throw new AIConfigError(`${provider.apiKeyEnv} is not set`);
  }

  client = new Anthropic({ apiKey, baseURL: provider.baseURL, maxRetries: 2 });
  return client;
}
