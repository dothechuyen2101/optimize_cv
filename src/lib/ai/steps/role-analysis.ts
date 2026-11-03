import "server-only";
import type { Locale } from "@/i18n/config";
import type { AtsResult, Market } from "@/lib/ats/score";
import { ROLE_ANALYSIS_PROMPT } from "../prompts/role-analysis";
import { runStructuredStep } from "../run-step";
import type { Job } from "../schemas/job";
import type { Resume } from "../schemas/resume";
import { RoleReportSchema } from "../schemas/role";

export interface RoleAnalysisInput {
  resume: Resume;
  job: Job;
  ats: AtsResult;
  market: Market;
  uiLanguage: Locale;
}

export function analyzeRole({ resume, job, ats, market, uiLanguage }: RoleAnalysisInput) {
  const payload = { job, resume, match: ats.coverage, settings: { market, ui_language: uiLanguage } };
  return runStructuredStep({
    step: "role_analysis",
    system: ROLE_ANALYSIS_PROMPT.system,
    content: [{ type: "text", text: JSON.stringify(payload) }],
    schema: RoleReportSchema,
  });
}
