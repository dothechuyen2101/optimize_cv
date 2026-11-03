import type { Resume } from "@/lib/ai/schemas/resume";

// Models transcribing a resume sometimes misread or swap characters ("09/2018" →
// "09/2008", "0912…" → "0921…"). Every field is meant to be copied verbatim, so a
// field missing from the document's text is replaced by the closest span of that
// text, when the span is a near-exact and unambiguous match.

/** Fields the model writes itself instead of copying from the document. */
const NOT_COPIED = new Set(["detected_language"]);
/** Longer fields are rare and slow to align; they keep the model's text. */
const MAX_FIELD_CHARS = 800;

interface Source {
  original: string;
  /** `original` lowercased with whitespace runs collapsed, for matching. */
  folded: string;
  /** Index in `original` of each character of `folded`. */
  origin: number[];
}

function fold(text: string): string {
  return text.normalize("NFC").replace(/\s+/g, " ").trim().toLowerCase();
}

function indexSource(text: string): Source {
  const original = text.normalize("NFC");
  let folded = "";
  const origin: number[] = [];
  for (let i = 0; i < original.length; i++) {
    if (/\s/.test(original[i])) {
      if (folded !== "" && !folded.endsWith(" ")) {
        folded += " ";
        origin.push(i);
      }
      continue;
    }
    for (const lower of original[i].toLowerCase()) {
      folded += lower;
      origin.push(i);
    }
  }
  return { original, folded, origin };
}

interface Match {
  start: number;
  end: number;
  cost: number;
}

/**
 * The cheapest spans of `text` that align with `pattern`, where inserting, deleting,
 * replacing or swapping two adjacent characters each cost 1 (optimal string alignment).
 */
function bestMatches(pattern: string, text: string): Match[] {
  const m = pattern.length;
  // Three DP columns (text positions j-2, j-1, j), each with where its alignment starts in `text`.
  let [cost2, cost1, cost0] = [new Int32Array(m + 1), new Int32Array(m + 1), new Int32Array(m + 1)];
  let [start2, start1, start0] = [new Int32Array(m + 1), new Int32Array(m + 1), new Int32Array(m + 1)];
  for (let i = 0; i <= m; i++) cost1[i] = i;

  let matches: Match[] = [];
  for (let j = 1; j <= text.length; j++) {
    // A match may start anywhere in the text.
    cost0[0] = 0;
    start0[0] = j;
    for (let i = 1; i <= m; i++) {
      let cost = cost1[i - 1] + (pattern[i - 1] === text[j - 1] ? 0 : 1);
      let start = start1[i - 1];
      if (cost0[i - 1] + 1 < cost) [cost, start] = [cost0[i - 1] + 1, start0[i - 1]];
      if (cost1[i] + 1 < cost) [cost, start] = [cost1[i] + 1, start1[i]];
      if (i > 1 && j > 1 && pattern[i - 1] === text[j - 2] && pattern[i - 2] === text[j - 1] && cost2[i - 2] + 1 < cost) {
        [cost, start] = [cost2[i - 2] + 1, start2[i - 2]];
      }
      cost0[i] = cost;
      start0[i] = start;
    }
    const match = { start: start0[m], end: j, cost: cost0[m] };
    if (matches.length === 0 || match.cost < matches[0].cost) matches = [match];
    else if (match.cost === matches[0].cost) matches.push(match);
    [cost2, cost1, cost0] = [cost1, cost0, cost2];
    [start2, start1, start0] = [start1, start0, start2];
  }
  return matches;
}

function allowedEdits(length: number): number {
  if (length <= 3) return 0;
  if (length <= 12) return 1;
  return Math.max(2, Math.floor(length * 0.08));
}

/** The source's own wording of `value`, or null when it is already verbatim or no span matches safely. */
function snap(value: string, source: Source): string | null {
  const pattern = fold(value);
  const limit = allowedEdits(pattern.length);
  if (limit === 0 || pattern.length > MAX_FIELD_CHARS || source.folded.includes(pattern)) return null;

  const matches = bestMatches(pattern, source.folded);
  const [first] = matches;
  if (!first || first.cost > limit) return null;
  // Ties at one spot only differ in where the span ends; ties at separate spots are ambiguous.
  if (matches.some((match) => match.start >= first.end || match.end <= first.start)) return null;

  const closest = matches.reduce((a, b) =>
    Math.abs(b.end - b.start - pattern.length) < Math.abs(a.end - a.start - pattern.length) ? b : a,
  );
  let span = source.original.slice(source.origin[closest.start], source.origin[closest.end - 1] + 1).trim();
  // The source couldn't decode a character there; the model's reading of the page is the better guess.
  if (span.includes("\uFFFD")) return null;
  // Keep list separators and bullet marks out of the field unless the model had them too.
  const trimmed = value.trim();
  if (!/[,;:]$/.test(trimmed)) span = span.replace(/[\s,;:]+$/, "");
  if (!/^[•–-]/.test(trimmed)) span = span.replace(/^[\s•–-]+/, "");
  // A single-line field keeps single spaces even where the source wrapped it.
  return value.includes("\n") ? span : span.replace(/\s+/g, " ");
}

/** Replaces misread fields with the matching text from the document; returns how many changed. */
export function groundResume(resume: Resume, sourceText: string): { resume: Resume; corrected: number } {
  const source = indexSource(sourceText);
  let corrected = 0;

  function visit(value: unknown, key: string | null): unknown {
    if (typeof value === "string") {
      if (key !== null && NOT_COPIED.has(key)) return value;
      const snapped = snap(value, source);
      if (snapped === null || snapped === value) return value;
      corrected++;
      return snapped;
    }
    if (Array.isArray(value)) return value.map((item) => visit(item, key));
    if (value !== null && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, visit(v, k)]));
    }
    return value;
  }

  return { resume: visit(resume, null) as Resume, corrected };
}
