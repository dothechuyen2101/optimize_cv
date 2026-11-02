import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth/next-path";
import { hasQuotaLeft, quotaWindowStart } from "@/lib/billing/quota";
import { analysisCacheKey, jdContentHash } from "./keys";

describe("jdContentHash", () => {
  it("ignores whitespace differences", () => {
    expect(jdContentHash("Senior  Backend\n\nEngineer ")).toBe(jdContentHash("Senior Backend Engineer"));
    expect(jdContentHash("Senior Backend Engineer")).not.toBe(jdContentHash("Junior Backend Engineer"));
  });
});

describe("analysisCacheKey", () => {
  const base = { fileHash: "f", jdHash: "j", market: "auto", uiLocale: "vi", promptVersions: ["a@1", "b@1"] };

  it("changes when any input or prompt version changes", () => {
    const key = analysisCacheKey(base);
    expect(analysisCacheKey({ ...base })).toBe(key);
    expect(analysisCacheKey({ ...base, market: "vn" })).not.toBe(key);
    expect(analysisCacheKey({ ...base, uiLocale: "en" })).not.toBe(key);
    expect(analysisCacheKey({ ...base, promptVersions: ["a@1", "b@2"] })).not.toBe(key);
  });
});

describe("quota", () => {
  it("starts the window at the first of the month in UTC", () => {
    expect(quotaWindowStart(new Date("2026-11-02T03:00:00Z")).toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(quotaWindowStart(new Date("2026-01-31T23:59:59Z")).toISOString()).toBe("2026-01-01T00:00:00.000Z");
  });

  it("treats a null limit as unlimited", () => {
    expect(hasQuotaLeft({ used: 2, limit: 3 })).toBe(true);
    expect(hasQuotaLeft({ used: 3, limit: 3 })).toBe(false);
    expect(hasQuotaLeft({ used: 999, limit: null })).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("keeps same-origin paths", () => {
    expect(safeNextPath("/vi/history?x=1", "/vi")).toBe("/vi/history?x=1");
  });

  it("rejects anything that could leave the site", () => {
    for (const value of ["https://evil.com", "//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "evil.com", "", null, undefined, 42]) {
      expect(safeNextPath(value, "/vi")).toBe("/vi");
    }
  });
});
