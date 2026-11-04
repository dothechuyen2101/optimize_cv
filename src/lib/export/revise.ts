import type { Analysis } from "@/lib/ai/schemas/analysis";
import type { Resume } from "@/lib/ai/schemas/resume";
import type { Choices } from "@/lib/analysis/types";
import { containsTerm, normalizeText } from "@/lib/ats/normalize";

type Section = "experience" | "project";

/** The resume with the user's accepted suggestions applied. */
export interface Revision {
  resume: Resume;
  /** Lines the accepted suggestions rewrote: `lineKey` values, or SUMMARY_LINE. */
  changed: Set<string>;
  /** Accepted suggestions, by index, whose original line isn't in the resume. */
  unplaced: number[];
  /** Projects written from GitHub, put before the resume's own: their proposal indexes, in order. */
  githubProjects: number[];
  /** Skills those projects added to the end of the skills list. */
  addedSkills: string[];
}

/** An accepted project from the user's GitHub, with the skills it adds. */
export interface GithubAddition {
  index: number;
  project: Resume["projects"][number];
  skills: string[];
}

export const SUMMARY_LINE = "summary";

/** The key of a bullet in the CV document (see document.ts). */
export function lineKey(section: Section, item: number, bullet: number): string {
  return `${section === "experience" ? "experience" : "projects"}.${item}.b.${bullet}`;
}

function comparable(line: string): string {
  return line
    .normalize("NFC")
    .replace(/^[\s•●▪◦*·–-]+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function locate(resume: Resume, section: Section, itemIndex: number, bulletIndex: number, original: string) {
  const items = section === "experience" ? resume.experiences : resume.projects;
  const target = comparable(original);
  if (target === "") return null;
  if (comparable(items[itemIndex]?.bullets[bulletIndex] ?? "") === target) return { item: itemIndex, bullet: bulletIndex };

  // The model's indexes are sometimes off, so look the line up by its text, in the same item first.
  for (const item of [itemIndex, ...items.keys()]) {
    const bullet = items[item]?.bullets.findIndex((line) => comparable(line) === target) ?? -1;
    if (bullet !== -1) return { item, bullet };
  }
  return null;
}

export function reviseResume(
  resume: Resume,
  analysis: Analysis,
  choices: Choices,
  github: GithubAddition[] = [],
): Revision {
  const revised = structuredClone(resume);
  const changed = new Set<string>();
  const unplaced: number[] = [];

  analysis.bullet_suggestions.forEach((suggestion, index) => {
    const choice = choices.bullets[index];
    if (choice?.decision !== "accepted") return;

    // Looked up in the original resume, so an earlier rewrite can't hide a later target.
    const spot = locate(resume, suggestion.section, suggestion.item_index, suggestion.bullet_index, suggestion.original);
    const key = spot && lineKey(suggestion.section, spot.item, spot.bullet);
    if (!spot || !key || changed.has(key)) {
      unplaced.push(index);
      return;
    }
    const text = choice.text ?? suggestion.proposed;
    const items = suggestion.section === "experience" ? revised.experiences : revised.projects;
    items[spot.item].bullets[spot.bullet] = text;
    changed.add(key);
  });

  if (choices.summary?.decision === "accepted") {
    revised.summary = choices.summary.text ?? analysis.summary_rewrite.proposed;
    changed.add(SUMMARY_LINE);
  }

  // After the suggestions, whose positions refer to the resume's own projects.
  revised.projects = [...github.map((added) => added.project), ...revised.projects];
  const addedSkills: string[] = [];
  for (const skill of github.flatMap((added) => added.skills)) {
    if (!containsTerm(normalizeText([...revised.skills, ...addedSkills].join(" , ")), skill)) addedSkills.push(skill);
  }
  revised.skills = [...revised.skills, ...addedSkills];

  return { resume: revised, changed, unplaced, githubProjects: github.map((added) => added.index), addedSkills };
}
