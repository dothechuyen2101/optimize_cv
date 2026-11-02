import { createHash } from "node:crypto";

export function sha256Hex(data: string | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Whitespace-insensitive, so the same JD pasted twice shares one cache entry. */
export function jdContentHash(jdText: string): string {
  return sha256Hex(jdText.replace(/\s+/g, " ").trim());
}

/** Identical inputs and prompt versions produce identical analyses, so the result can be reused. */
export function analysisCacheKey(parts: {
  fileHash: string;
  jdHash: string;
  market: string;
  uiLocale: string;
  promptVersions: readonly string[];
}): string {
  return sha256Hex([parts.fileHash, parts.jdHash, parts.market, parts.uiLocale, ...parts.promptVersions].join("|"));
}
