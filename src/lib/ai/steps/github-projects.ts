import "server-only";
import type { Locale } from "@/i18n/config";
import type { Market } from "@/lib/ats/score";
import type { GithubRepo } from "@/lib/portfolio/fetch";
import { GITHUB_PROJECTS_PROMPT } from "../prompts/github-projects";
import { runStructuredStep } from "../run-step";
import { GithubProjectsSchema } from "../schemas/github-projects";
import type { Job } from "../schemas/job";
import type { Resume } from "../schemas/resume";

export interface GithubProjectsInput {
  resume: Resume;
  job: Job;
  market: Market;
  repos: GithubRepo[];
  /** The user linked this one repository rather than their whole account. */
  chosenByCandidate: boolean;
  uiLanguage: Locale;
}

export function writeGithubProjects({ resume, job, market, repos, chosenByCandidate, uiLanguage }: GithubProjectsInput) {
  const payload = {
    job,
    resume,
    repositories: repos,
    settings: {
      cv_language: resume.detected_language === "vi" ? "vi" : "en",
      ui_language: uiLanguage,
      market,
      chosen_by_candidate: chosenByCandidate,
    },
  };
  return runStructuredStep({
    step: "github_projects",
    system: GITHUB_PROJECTS_PROMPT.system,
    content: [{ type: "text", text: JSON.stringify(payload) }],
    schema: GithubProjectsSchema,
  });
}
