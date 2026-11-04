import type { Dictionary } from "@/i18n/types";
import type { Resume } from "@/lib/ai/schemas/resume";
import type { AnalysisErrorCode, Decision } from "@/lib/analysis/types";

/** A resume project written from one GitHub repository, for the user to accept or skip. */
export interface ProjectProposal {
  repo: string;
  url: string;
  name: string;
  description: string;
  technologies: string[];
  bullets: string[];
  matched_requirements: string[];
  reason: string;
  /** Skills it adds to the resume's skills list when accepted. */
  new_skills: string[];
}

export interface ProjectImportResult {
  owner: string;
  /** How many repositories were read closely for this job. */
  considered: number;
  proposals: ProjectProposal[];
  skipped: { repo: string; reason: string }[];
}

/** The user's call on each proposal, keyed by its index; undecided ones are absent. */
export type ProjectDecisions = Record<string, Decision>;

export type ProjectImportState =
  | { status: "none" }
  | { status: "running"; source: string }
  | { status: "failed"; source: string; errorCode: string | null }
  | { status: "completed"; source: string; result: ProjectImportResult; decisions: ProjectDecisions };

export type ProjectsErrorCode =
  | AnalysisErrorCode
  | "invalid_github"
  | "github_not_found"
  | "github_rate_limited"
  | "github_unreachable"
  | "no_repos";

/** The proposal as an entry of the resume's projects; its repository link stands in the role line. */
export function toResumeProject(proposal: ProjectProposal): Resume["projects"][number] {
  return {
    name: proposal.name,
    role: proposal.url.replace(/^https?:\/\//, ""),
    description: proposal.description || null,
    bullets: proposal.bullets,
    technologies: proposal.technologies,
  };
}

/** The message for a projects error: GitHub problems first, then the errors it shares with analyses. */
export function projectsError(
  code: string,
  dict: Dictionary["projects"]["errors"],
  errors: Dictionary["analyze"]["errors"],
): string {
  if (code in dict) return dict[code as keyof typeof dict];
  return errors[code as keyof typeof errors] ?? errors.server;
}
