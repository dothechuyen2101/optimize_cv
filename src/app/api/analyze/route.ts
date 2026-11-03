import Anthropic from "@anthropic-ai/sdk";
import { hasLocale, type Locale } from "@/i18n/config";
import { AIConfigError, getProvider, providerApiKey } from "@/lib/ai/providers";
import { AIStepError, type UsageRecord } from "@/lib/ai/run-step";
import { analysisCacheKey, jdContentHash } from "@/lib/analysis/keys";
import type { Job } from "@/lib/ai/schemas/job";
import type { Resume } from "@/lib/ai/schemas/resume";
import { PROMPT_VERSIONS, runAnalysis, type AnalysisInputs, type Stored } from "@/lib/analysis/run-analysis";
import {
  completeAnalysis,
  failAnalysis,
  findCachedAnalysis,
  loadOrParseJob,
  loadOrParseResume,
  recordUsage,
  reserveAnalysis,
  sameJobAnalysis,
  saveRevisedResume,
} from "@/lib/analysis/service";
import { JD_MAX_CHARS, JD_MIN_CHARS, type AnalysisErrorCode, type AnalysisEvent } from "@/lib/analysis/types";
import { getSessionUser } from "@/lib/auth/session";
import { loadReanalysisInputs } from "@/lib/export/service";
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

type OnUsage = (usage: UsageRecord) => Promise<void>;

/** What an analysis runs on, before quota is reserved. */
interface Prepared {
  /** Identifies the resume input for the cache: the uploaded file, or the revised CV. */
  resumeHash: string;
  jdHash: string;
  market: AnalysisInputs["market"];
  resume: (onUsage: OnUsage) => Promise<Stored<Resume>>;
  job: (onUsage: OnUsage) => Promise<Stored<Job>>;
  parentId?: string;
}

/**
 * A new analysis: an uploaded CV file and a pasted JD. With parent=<analysis id> of the same JD,
 * e.g. a CV revised outside the app and uploaded again, the result is compared with that analysis.
 */
async function prepareUpload(userId: string, form: FormData): Promise<Prepared | AnalysisErrorCode> {
  const file = form.get("cv");
  const jdText = String(form.get("jd") ?? "").trim();
  const market = String(form.get("market") ?? "auto");

  if (!(file instanceof File) || file.size === 0) return "missing_file";
  if (jdText.length < JD_MIN_CHARS) return "jd_too_short";
  if (jdText.length > JD_MAX_CHARS) return "jd_too_long";
  if (!isMarket(market)) return "invalid_request";

  let upload: CvUpload;
  try {
    upload = await readCvUpload(file);
  } catch (error) {
    if (error instanceof CvFileRejected) return error.code;
    throw error;
  }
  const jdHash = jdContentHash(jdText);
  const parent = form.get("parent");
  const parentId = typeof parent === "string" ? await sameJobAnalysis(userId, parent, jdHash) : null;
  return {
    resumeHash: upload.contentHash,
    jdHash,
    market,
    parentId: parentId ?? undefined,
    resume: (onUsage) => loadOrParseResume(userId, upload, onUsage),
    job: (onUsage) => loadOrParseJob(jdText, jdHash, onUsage),
  };
}

/** A re-evaluation: the revised CV of the user's earlier analysis, against the same JD. Nothing is re-parsed. */
async function prepareReanalysis(userId: string, analysisId: string): Promise<Prepared | AnalysisErrorCode> {
  const inputs = await loadReanalysisInputs(userId, analysisId);
  if (!inputs) return "invalid_request";
  return {
    resumeHash: inputs.resumeHash,
    jdHash: inputs.jdHash,
    market: inputs.market,
    resume: () => saveRevisedResume(inputs.fromVersionId, inputs.resume, inputs.resumeHash),
    job: async () => inputs.job,
    parentId: analysisId,
  };
}

/** Form fields: lang, plus either cv, jd, market and optionally parent for a new analysis, or from=<analysis id> to re-evaluate. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail("unauthorized", 401);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("invalid_request");
  }

  const lang = String(form.get("lang") ?? "");
  if (!hasLocale(lang)) return fail("invalid_request");
  const uiLanguage: Locale = lang;
  const from = form.get("from");
  const prepared = typeof from === "string" ? await prepareReanalysis(user.id, from) : await prepareUpload(user.id, form);
  if (typeof prepared === "string") return fail(prepared);

  const cacheKey = analysisCacheKey({
    fileHash: prepared.resumeHash,
    jdHash: prepared.jdHash,
    market: prepared.market,
    uiLocale: uiLanguage,
    promptVersions: PROMPT_VERSIONS,
  });

  // Identical inputs: show the earlier result, without AI cost or quota.
  const cachedId = await findCachedAnalysis(user.id, cacheKey);
  if (cachedId) return ndjson(async (send) => send({ type: "result", analysisId: cachedId }));

  const reservation = await reserveAnalysis(user.id, {
    cacheKey,
    uiLocale: uiLanguage,
    promptVersions: PROMPT_VERSIONS,
    parentId: prepared.parentId,
  });
  if ("quota" in reservation) return fail("quota_exceeded", 429);
  const analysisId = reservation.id;
  const onUsage = (usage: UsageRecord) => recordUsage(user.id, analysisId, usage);

  return ndjson(async (send) => {
    try {
      const outcome = await runAnalysis(
        {
          resume: () => prepared.resume(onUsage),
          job: () => prepared.job(onUsage),
          market: prepared.market,
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
