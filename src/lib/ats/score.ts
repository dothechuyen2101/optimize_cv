import type { Job, JobTerm } from "@/lib/ai/schemas/job";
import type { Resume } from "@/lib/ai/schemas/resume";
import { containsTerm, normalizeText } from "./normalize";

export type Market = "vn" | "international";

export type AtsComponentKey = "required" | "preferred" | "keywords" | "experience" | "format";

export type FormatIssueCode =
  | "missing_email"
  | "missing_phone"
  | "missing_experience_section"
  | "missing_skills_section"
  | "missing_education_section"
  | "missing_summary"
  | "low_metrics"
  | "long_bullets"
  | "too_long"
  | "too_short"
  | "photo_international"
  | "dob_international";

export interface FormatIssue {
  code: FormatIssueCode;
  severity: "high" | "medium" | "low";
}

export interface TermCoverage {
  matched: string[];
  missing: string[];
}

export interface AtsResult {
  overall: number;
  /** 0-100 per component; null when the JD gives nothing to score against. */
  components: Record<AtsComponentKey, number | null>;
  coverage: { required: TermCoverage; preferred: TermCoverage; keywords: TermCoverage };
  experience: { requiredYears: number | null; candidateYears: number | null };
  formatIssues: FormatIssue[];
  stats: { wordCount: number; bulletCount: number; bulletsWithMetrics: number };
}

export const COMPONENT_WEIGHTS: Record<AtsComponentKey, number> = {
  required: 40,
  preferred: 15,
  keywords: 20,
  experience: 15,
  format: 10,
};

const FORMAT_PENALTY: Record<FormatIssue["severity"], number> = { high: 25, medium: 12, low: 5 };

const METRIC_PATTERN = /\d/;
const LONG_BULLET_WORDS = 40;
const MAX_WORDS = 1200;
const MIN_WORDS = 150;

function resumeCorpus(resume: Resume): string {
  return [
    resume.headline,
    resume.summary,
    ...resume.skills,
    ...resume.certifications,
    ...resume.experiences.flatMap((e) => [e.title, e.company, ...e.bullets]),
    ...resume.projects.flatMap((p) => [p.name, p.role, p.description, ...p.bullets, ...p.technologies]),
    ...resume.education.flatMap((e) => [e.degree, e.field, e.school]),
    ...resume.languages.map((l) => l.language),
    ...resume.other_sections.flatMap((s) => [s.title, s.content]),
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n");
}

function dedupe(terms: JobTerm[]): JobTerm[] {
  const seen = new Set<string>();
  return terms.filter(({ term }) => {
    const key = normalizeText(term);
    if (key.trim() === "" || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// A term counts as present when the resume uses it or any alias (translation,
// spelling variant or accepted alternative).
function coverage(corpus: string, terms: JobTerm[]): TermCoverage {
  const result: TermCoverage = { matched: [], missing: [] };
  for (const { term, aliases } of dedupe(terms)) {
    const found = [term, ...aliases].some((variant) => containsTerm(corpus, variant));
    (found ? result.matched : result.missing).push(term);
  }
  return result;
}

function coverageScore({ matched, missing }: TermCoverage): number | null {
  const total = matched.length + missing.length;
  return total === 0 ? null : Math.round((matched.length / total) * 100);
}

function experienceScore(requiredYears: number | null, candidateYears: number | null): number | null {
  if (requiredYears === null || requiredYears <= 0) return null;
  // Unknown experience is neither rewarded nor fully penalized.
  if (candidateYears === null) return 50;
  return Math.round(Math.min(1, candidateYears / requiredYears) * 100);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function formatIssues(resume: Resume, market: Market, wordCount: number, bullets: string[]): FormatIssue[] {
  const issues: FormatIssue[] = [];
  const add = (code: FormatIssueCode, severity: FormatIssue["severity"]) => issues.push({ code, severity });

  if (!resume.email) add("missing_email", "high");
  if (!resume.phone) add("missing_phone", "medium");
  if (resume.experiences.length === 0 && resume.projects.length === 0) add("missing_experience_section", "high");
  if (resume.skills.length === 0) add("missing_skills_section", "medium");
  if (resume.education.length === 0) add("missing_education_section", "low");
  if (!resume.summary) add("missing_summary", "low");

  if (bullets.length >= 4) {
    const withMetrics = bullets.filter((b) => METRIC_PATTERN.test(b)).length;
    if (withMetrics / bullets.length < 0.3) add("low_metrics", "medium");
    const long = bullets.filter((b) => countWords(b) > LONG_BULLET_WORDS).length;
    if (long / bullets.length > 0.3) add("long_bullets", "low");
  }

  if (wordCount > MAX_WORDS) add("too_long", "medium");
  if (wordCount < MIN_WORDS) add("too_short", "medium");

  if (market === "international") {
    if (resume.has_photo) add("photo_international", "low");
    if (resume.has_date_of_birth) add("dob_international", "low");
  }
  return issues;
}

export function scoreAts(resume: Resume, job: Job, market: Market): AtsResult {
  const rawCorpus = resumeCorpus(resume);
  const corpus = normalizeText(rawCorpus);
  const bullets = [...resume.experiences.flatMap((e) => e.bullets), ...resume.projects.flatMap((p) => p.bullets)];
  const wordCount = countWords(rawCorpus);

  const required = coverage(corpus, job.required_skills);
  const preferred = coverage(corpus, job.preferred_skills);
  const keywords = coverage(corpus, job.keywords);
  const issues = formatIssues(resume, market, wordCount, bullets);

  const components: AtsResult["components"] = {
    required: coverageScore(required),
    preferred: coverageScore(preferred),
    keywords: coverageScore(keywords),
    experience: experienceScore(job.min_years_experience, resume.total_years_experience),
    format: Math.max(0, 100 - issues.reduce((sum, issue) => sum + FORMAT_PENALTY[issue.severity], 0)),
  };

  // Components the JD can't be scored against drop out and the rest are re-weighted.
  let weighted = 0;
  let totalWeight = 0;
  for (const key of Object.keys(COMPONENT_WEIGHTS) as AtsComponentKey[]) {
    const score = components[key];
    if (score === null) continue;
    weighted += score * COMPONENT_WEIGHTS[key];
    totalWeight += COMPONENT_WEIGHTS[key];
  }

  return {
    overall: totalWeight === 0 ? 0 : Math.round(weighted / totalWeight),
    components,
    coverage: { required, preferred, keywords },
    experience: { requiredYears: job.min_years_experience, candidateYears: resume.total_years_experience },
    formatIssues: issues,
    stats: {
      wordCount,
      bulletCount: bullets.length,
      bulletsWithMetrics: bullets.filter((b) => METRIC_PATTERN.test(b)).length,
    },
  };
}
