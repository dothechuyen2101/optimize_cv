import Anthropic from "@anthropic-ai/sdk";
import { hasLocale, type Locale } from "@/i18n/config";
import { AIConfigError, getProvider, providerApiKey } from "@/lib/ai/providers";
import { AIStepError, type UsageRecord } from "@/lib/ai/run-step";
import { analysisCacheKey, jdContentHash } from "@/lib/analysis/keys";
import { PROMPT_VERSIONS, runAnalysis, type AnalysisInputs } from "@/lib/analysis/run-analysis";
import {
  completeAnalysis,
  failAnalysis,
  findCachedAnalysis,
  loadOrParseJob,
  loadOrParseResume,
  recordUsage,
  reserveAnalysis,
} from "@/lib/analysis/service";
import { JD_MAX_CHARS, JD_MIN_CHARS, type AnalysisErrorCode, type AnalysisEvent } from "@/lib/analysis/types";
import { getSessionUser } from "@/lib/auth/session";
import { CvFileRejected, readCvUpload, type CvUpload } from "@/lib/parsing/cv-document";

// Parsing + analysis usually takes 30-120 seconds.
export const maxDuration = 180;

const MARKETS = ["auto", "vn", "international"] as const;

function isMarket(value: string): value is AnalysisInputs["market"] {
  return (MARKETS as readonly string[]).includes(value);
}

function fail(code: AnalysisErrorCode, status = 400) {
  return Response.json({ type: "error", code } satisfies AnalysisEvent, { status });
}

function errorCode(error: unknown): AnalysisErrorCode {
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

function ndjson(run: (send: (event: AnalysisEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        await run((event) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail("unauthorized", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("invalid_request");
  }

  const file = form.get("cv");
  const jdText = String(form.get("jd") ?? "").trim();
  const lang = String(form.get("lang") ?? "");
  const market = String(form.get("market") ?? "auto");

  if (!(file instanceof File) || file.size === 0) return fail("missing_file");
  if (jdText.length < JD_MIN_CHARS) return fail("jd_too_short");
  if (jdText.length > JD_MAX_CHARS) return fail("jd_too_long");
  if (!hasLocale(lang) || !isMarket(market)) return fail("invalid_request");
  const uiLanguage: Locale = lang;

  let upload: CvUpload;
  try {
    upload = await readCvUpload(file);
  } catch (error) {
    if (error instanceof CvFileRejected) return fail(error.code);
    throw error;
  }

  const jdHash = jdContentHash(jdText);
  const cacheKey = analysisCacheKey({
    fileHash: upload.contentHash,
    jdHash,
    market,
    uiLocale: uiLanguage,
    promptVersions: PROMPT_VERSIONS,
  });

  // Identical inputs: show the earlier result, without AI cost or quota.
  const cachedId = await findCachedAnalysis(user.id, cacheKey);
  if (cachedId) return ndjson(async (send) => send({ type: "result", analysisId: cachedId }));

  const reservation = await reserveAnalysis(user.id, { cacheKey, uiLocale: uiLanguage, promptVersions: PROMPT_VERSIONS });
  if ("quota" in reservation) return fail("quota_exceeded", 429);
  const analysisId = reservation.id;
  const onUsage = (usage: UsageRecord) => recordUsage(user.id, analysisId, usage);

  return ndjson(async (send) => {
    try {
      const outcome = await runAnalysis(
        {
          resume: () => loadOrParseResume(user.id, upload, onUsage),
          job: () => loadOrParseJob(jdText, jdHash, onUsage),
          market,
          uiLanguage,
          onUsage,
        },
        (stage) => send({ type: "stage", stage }),
      );
      await completeAnalysis(analysisId, outcome);
      send({ type: "result", analysisId });
    } catch (error) {
      console.error("[analyze] failed", error);
      const code = errorCode(error);
      // A failed call that still returned a response was billed.
      if (error instanceof AIStepError) await onUsage(error.usage).catch(() => {});
      await failAnalysis(analysisId, code).catch(() => {});
      send({ type: "error", code });
    }
  });
}
