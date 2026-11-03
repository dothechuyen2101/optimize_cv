import "server-only";
import { getDb } from "@/db";
import { aiUsage } from "@/db/schema";
import type { Locale } from "@/i18n/config";

// The browser streams microphone audio straight to Deepgram; Vercel functions can't hold a
// socket open. It authenticates with a token that only opens sockets for 30 seconds, so the
// API key itself never leaves the server.

const TOKEN_TTL_SECONDS = 30;

export class SpeechUnavailableError extends Error {
  constructor() {
    super("DEEPGRAM_API_KEY is not set");
    this.name = "SpeechUnavailableError";
  }
}

export function speechInputConfigured(): boolean {
  return Boolean(process.env.DEEPGRAM_API_KEY);
}

/** The live-transcription socket URL for an interview's language. */
export function listenUrl(language: Locale): string {
  const params = new URLSearchParams({
    model: "nova-3",
    language,
    smart_format: "true",
    interim_results: "true",
    // Candidates' voices: Deepgram keeps the audio only while processing it, never for training.
    mip_opt_out: "true",
  });
  return `wss://api.deepgram.com/v1/listen?${params}`;
}

export async function grantListenToken(): Promise<string> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) throw new SpeechUnavailableError();
  const response = await fetch("https://api.deepgram.com/v1/auth/grant", {
    method: "POST",
    headers: { authorization: `Token ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ ttl_seconds: TOKEN_TTL_SECONDS }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => null)) as { access_token?: string } | null;
  if (!response.ok || !body?.access_token) throw new Error(`Deepgram token grant failed: HTTP ${response.status}`);
  return body.access_token;
}

/**
 * Logs one listening session in ai_usage, so it counts toward the per-user rate limit and
 * shows in usage reports. Deepgram bills by audio length, which only its console knows.
 */
export async function recordListenSession(userId: string, analysisId: string): Promise<void> {
  await getDb().insert(aiUsage).values({
    userId,
    analysisId,
    step: "speech_to_text",
    provider: "deepgram",
    model: "nova-3",
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    durationMs: 0,
  });
}
