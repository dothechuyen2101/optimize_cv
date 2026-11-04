import type { GithubProjects } from "@/lib/ai/schemas/github-projects";
import type { Job } from "@/lib/ai/schemas/job";
import type { Resume } from "@/lib/ai/schemas/resume";
import { containsTerm, normalizeText } from "@/lib/ats/normalize";
import type { GithubRepoInfo } from "@/lib/portfolio/fetch";
import type { ProjectImportResult } from "./types";

/** Repositories whose READMEs the model reads; ranking by code keeps the prompt small. */
export const MAX_CANDIDATES = 8;
export const README_CHARS = 2500;
const MAX_PROPOSALS = 4;
const MAX_BULLETS = 4;
const MAX_SKIPPED = 6;
const DAY_MS = 86_400_000;

// Repositories that are never projects: profile READMEs and configuration.
const NOT_PROJECTS = /^(\.github|dotfiles|config|configs)$/i;

function squashed(name: string): string {
  return normalizeText(name).replace(/ /g, "");
}

/** Trimmed, without blanks or case-insensitive repeats. */
function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items.map((value) => value.trim())) {
    if (item === "" || seen.has(item.toLowerCase())) continue;
    seen.add(item.toLowerCase());
    result.push(item);
  }
  return result;
}

/**
 * The repositories most worth reading for this job: the JD's terms in their name, description,
 * language and topics, then recent activity and substance. Projects the resume already lists are left out.
 */
export function rankRepos(repos: GithubRepoInfo[], job: Job, resume: Resume, owner: string, now = new Date()) {
  const listed = new Set(resume.projects.map((project) => squashed(project.name)));
  const terms = [
    ...job.required_skills.map((term) => ({ term, weight: 3 })),
    ...job.preferred_skills.map((term) => ({ term, weight: 2 })),
    ...job.keywords.map((term) => ({ term, weight: 1 })),
  ];

  return repos
    .filter((repo) => !NOT_PROJECTS.test(repo.name) && repo.name.toLowerCase() !== owner.toLowerCase())
    .filter((repo) => !listed.has(squashed(repo.name)))
    .map((repo) => {
      const corpus = normalizeText(
        [repo.name.replace(/[-_.]+/g, " "), repo.description, repo.language, ...repo.topics.map((t) => t.replace(/-/g, " "))]
          .filter(Boolean)
          .join(" , "),
      );
      const relevance = terms.reduce(
        (sum, { term, weight }) => sum + ([term.term, ...term.aliases].some((name) => containsTerm(corpus, name)) ? weight : 0),
        0,
      );
      const ageDays = (now.getTime() - Date.parse(repo.pushed_at)) / DAY_MS;
      const recency = ageDays < 365 ? 2 : ageDays < 730 ? 1 : 0;
      const substance = (repo.description ? 1 : 0) + Math.min(2, Math.log10(repo.stars + 1));
      return { repo, score: relevance * 2 + recency + substance };
    })
    .sort((a, b) => b.score - a.score || b.repo.pushed_at.localeCompare(a.repo.pushed_at))
    .slice(0, MAX_CANDIDATES)
    .map(({ repo }) => repo);
}

/**
 * Keeps the model's projects that name a repository it was given, once each, and drops
 * skills the resume already lists: the model can't add a project for a repository it never read.
 */
export function finalizeProposals(
  output: GithubProjects,
  candidates: { name: string }[],
  resume: Resume,
  owner: string,
): ProjectImportResult {
  const byName = new Map(candidates.map((repo) => [repo.name.toLowerCase(), repo.name]));
  const skills = normalizeText(resume.skills.join(" , "));
  const used = new Set<string>();

  const proposals = output.projects.flatMap((project) => {
    const repo = byName.get(project.repo.trim().toLowerCase());
    const bullets = unique(project.bullets).slice(0, MAX_BULLETS);
    if (!repo || used.has(repo) || used.size >= MAX_PROPOSALS || bullets.length === 0) return [];
    used.add(repo);
    return [
      {
        repo,
        url: `https://github.com/${owner}/${repo}`,
        name: project.name.trim() || repo,
        description: project.description.trim(),
        technologies: unique(project.technologies),
        bullets,
        matched_requirements: unique(project.matched_requirements),
        reason: project.reason.trim(),
        new_skills: unique(project.new_skills).filter((skill) => !containsTerm(skills, skill)),
      },
    ];
  });

  const skipped = output.skipped
    .map((item) => ({ repo: byName.get(item.repo.trim().toLowerCase()), reason: item.reason.trim() }))
    .filter((item): item is { repo: string; reason: string } => !!item.repo && !used.has(item.repo))
    .slice(0, MAX_SKIPPED);

  return { owner, considered: candidates.length, proposals, skipped };
}
