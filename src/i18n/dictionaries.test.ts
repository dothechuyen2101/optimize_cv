import { describe, expect, it } from "vitest";
import en from "./dictionaries/en.json";
import vi from "./dictionaries/vi.json";

function keyPaths(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keyPaths(child, prefix ? `${prefix}.${key}` : key));
}

describe("dictionaries", () => {
  it("vi and en define exactly the same keys", () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(vi).sort());
  });
});
