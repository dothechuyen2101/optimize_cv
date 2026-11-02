import "server-only";
import type { Locale } from "@/i18n/config";
import type { AtsResult, Market } from "@/lib/ats/score";
import { ANALYZE_MATCH_PROMPT } from "../prompts/analyze-match";
import { runStructuredStep } from "../run-step";
import { AnalysisSchema } from "../schemas/analysis";
import type { Job } from "../schemas/job";
import type { Resume } from "../schemas/resume";

export interface AnalyzeMatchInput {
  resume: Resume;
  job: Job;
  ats: AtsResult;
  market: Market;
  uiLanguage: Locale;
}

export function analyzeMatch({ resume, job, ats, market, uiLanguage }: AnalyzeMatchInput) {
  const payload = {
    resume,
    job,
    // The model only needs the conclusions, not the raw stats.
    ats: {
      overall: ats.overall,
      components: ats.components,
      coverage: ats.coverage,
      experience: ats.experience,
      format_issues: ats.formatIssues.map((issue) => issue.code),
    },
    settings: { market, ui_language: uiLanguage, cv_language: resume.detected_language },
  };

  return runStructuredStep({
    step: "analyze_match",
    system: ANALYZE_MATCH_PROMPT.system,
    content: [{ type: "text", text: JSON.stringify(payload) }],
    schema: AnalysisSchema,
  });
}
