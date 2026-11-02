// Text normalization shared by both sides of ATS matching: a JD term and the
// resume corpus go through the same function, so aliases only need to map
// every spelling onto one canonical form.

const COMBINING_MARKS = /[̀-ͯ]/g;

// Multi-word aliases must be listed in normalized form (lowercase, no diacritics,
// punctuation already turned into spaces).
const ALIASES: Record<string, string> = {
  "react js": "react",
  reactjs: "react",
  "node js": "nodejs",
  node: "nodejs",
  "next js": "nextjs",
  "vue js": "vue",
  vuejs: "vue",
  angularjs: "angular",
  js: "javascript",
  ts: "typescript",
  postgres: "postgresql",
  k8s: "kubernetes",
  mongo: "mongodb",
  "ci cd": "cicd",
  "amazon web services": "aws",
  "google cloud platform": "gcp",
  "google cloud": "gcp",
  ml: "machine learning",
  ai: "artificial intelligence",
  nlp: "natural language processing",
  powerbi: "power bi",
  "microsoft excel": "excel",
  "ms excel": "excel",
  "restful apis": "rest api",
  "restful api": "rest api",
  "rest apis": "rest api",
  restful: "rest api",
  "ui ux": "uiux",
  "ux ui": "uiux",
};

const ALIAS_PATTERNS = Object.entries(ALIASES)
  // Longest first so "react js" wins over a shorter alias inside it.
  .sort(([a], [b]) => b.length - a.length)
  .map(([from, to]) => [new RegExp(`(?<= )${escapeRegExp(from)}(?= )`, "g"), to] as const);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Lowercases, strips Vietnamese diacritics, keeps tech punctuation (`c++`, `c#`)
 * and returns the text padded with single spaces so callers can match whole
 * words with a plain `includes(" term ")`.
 */
export function normalizeText(input: string): string {
  let text = input
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d");

  text = text.replace(/\.net\b/g, " dotnet ").replace(/([a-z0-9])\.js\b/g, "$1js");
  text = ` ${text.replace(/[^a-z0-9+#]+/g, " ").trim()} `;

  for (const [pattern, canonical] of ALIAS_PATTERNS) {
    text = text.replace(pattern, canonical);
  }
  return text;
}

/** The normalized term with its last word switched between singular and plural, if that's safe. */
function otherNumber(normalizedTerm: string): string | null {
  const body = normalizedTerm.trimEnd();
  const lastWord = body.slice(body.lastIndexOf(" ") + 1);
  if (!/^[a-z]{3,}$/.test(lastWord) || lastWord.endsWith("ss")) return null;
  return lastWord.endsWith("s") ? `${body.slice(0, -1)} ` : `${body}s `;
}

/** Whole-word match; "code review" also matches "code reviews" and vice versa. */
export function containsTerm(normalizedCorpus: string, term: string): boolean {
  const normalizedTerm = normalizeText(term);
  if (normalizedTerm.trim() === "") return false;
  const variant = otherNumber(normalizedTerm);
  return normalizedCorpus.includes(normalizedTerm) || (variant !== null && normalizedCorpus.includes(variant));
}
