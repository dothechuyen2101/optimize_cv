interface VoiceLike {
  name: string;
  lang: string;
}

/** The best installed voice for a language, preferring the natural-sounding cloud voices (e.g. Edge's). */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], language: "vi" | "en"): V | null {
  const matching = voices.filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith(language));
  const score = (voice: V) =>
    (/natural|neural|online/i.test(voice.name) ? 2 : 0) +
    (/google/i.test(voice.name) ? 1 : 0) +
    (language === "en" && /en-us/i.test(voice.lang) ? 0.5 : 0);
  return [...matching].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Text in sentence-sized pieces: Chrome stops reading a single utterance after about 15 seconds. */
export function speechChunks(text: string, max = 200): string[] {
  const chunks: string[] = [];
  for (const sentence of text.replace(/\s+/g, " ").trim().split(/(?<=[.!?…])\s+/)) {
    if (sentence.length <= max) {
      chunks.push(sentence);
      continue;
    }
    let current = "";
    for (const part of sentence.split(/(?<=[,;:])\s+/)) {
      if (current && `${current} ${part}`.length > max) {
        chunks.push(current);
        current = part;
      } else {
        current = current ? `${current} ${part}` : part;
      }
    }
    chunks.push(current);
  }
  return chunks.filter(Boolean);
}

/** The draft with a spoken answer appended. */
export function withSpokenText(draft: string, spoken: string): string {
  return [draft.trim(), spoken.trim()].filter(Boolean).join(" ");
}
