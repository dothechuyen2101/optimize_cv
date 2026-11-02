import { describe, expect, it } from "vitest";
import { estimateCostUsd } from "./pricing";

describe("estimateCostUsd", () => {
  it("prices fresh input, output, cache writes and cache reads separately", () => {
    const pricing = { input: 0.8, output: 4, cacheWrite: 1, cacheRead: 0.08 };
    const cost = estimateCostUsd(pricing, {
      input_tokens: 10_000,
      output_tokens: 5_000,
      cache_creation_input_tokens: 2_000,
      cache_read_input_tokens: 50_000,
    });
    // 0.008 + 0.02 + 0.002 + 0.004
    expect(cost).toBeCloseTo(0.034, 10);
  });

  it("treats missing cache counts as zero", () => {
    const pricing = { input: 1, output: 1, cacheWrite: 1, cacheRead: 1 };
    const cost = estimateCostUsd(pricing, {
      input_tokens: 1_000_000,
      output_tokens: 0,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
    });
    expect(cost).toBe(1);
  });
});
