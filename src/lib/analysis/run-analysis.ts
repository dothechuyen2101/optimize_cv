import "server-only";
import type { Locale } from "@/i18n/config";
import { ANALYZE_MATCH_PROMPT } from "@/lib/ai/prompts/analyze-match";
import { PARSE_CV_PROMPT } from "@/lib/ai/prompts/parse-cv";
import { PARSE_JD_PROMPT } from "@/lib/ai/prompts/parse-jd";
import type { UsageRecord } from "@/lib/ai/run-step";
import type { Analysis } from "@/lib/ai/schemas/analysis";
import type { Job } from "@/lib/ai/schemas/job";
import type { Resume } from "@/lib/ai/schemas/resume";
import { analyzeMatch } from "@/lib/ai/steps/analyze-match";
import { scoreAts, type AtsResult, type Market } from "@/lib/ats/score";
import type { AnalysisStage } from "./types";

export const PROMPT_VERSIONS = [PARSE_CV_PROMPT.version, PARSE_JD_PROMPT.version, ANALYZE_MATCH_PROMPT.version];

/** A parsed input and the row it is stored in. */
export interface Stored<T> {
  id: string;
  value: T;
}

export interface AnalysisInputs {
  /** Load from cache or parse with AI; implementations persist what they parse. */
  resume: () => Promise<Stored<Resume>>;
  job: () => Promise<Stored<Job>>;
  market: Market | "auto";
  uiLanguage: Locale;
  onUsage: (usage: UsageRecord) => Promise<void>;
}

export interface AnalysisOutcome {
  resumeVersionId: string;
  jobDescriptionId: string;
  market: Market;
  ats: AtsResult;
  analysis: Analysis;
}

function resolveMarket(requested: AnalysisInputs["market"], job: Job): Market {
  if (requested !== "auto") return requested;
  if (job.market !== "unknown") return job.market;
  return job.detected_language === "vi" ? "vn" : "international";
}

export async function runAnalysis(
  inputs: AnalysisInputs,
  onStage: (stage: AnalysisStage) => void,
): Promise<AnalysisOutcome> {
  onStage("parsing");
  const [resume, job] = await Promise.all([inputs.resume(), inputs.job()]);

  onStage("scoring");
  const market = resolveMarket(inputs.market, job.value);
  const ats = scoreAts(resume.value, job.value, market);

  onStage("analyzing");
  const { output, usage } = await analyzeMatch({
    resume: resume.value,
    job: job.value,
    ats,
    market,
    uiLanguage: inputs.uiLanguage,
  });
  await inputs.onUsage(usage);

  return { resumeVersionId: resume.id, jobDescriptionId: job.id, market, ats, analysis: output };
}
