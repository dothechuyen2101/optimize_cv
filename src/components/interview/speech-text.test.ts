import { describe, expect, it } from "vitest";
import { pickVoice, speechChunks, withSpokenText } from "./speech-text";

const VOICES = [
  { name: "Microsoft David - English (United States)", lang: "en-US" },
  { name: "Google UK English Female", lang: "en-GB" },
  { name: "Microsoft An - Vietnamese (Vietnam)", lang: "vi-VN" },
  { name: "Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)", lang: "vi-VN" },
  { name: "Linh", lang: "vi_VN" },
];

describe("pickVoice", () => {
  it("prefers natural voices in the right language", () => {
    expect(pickVoice(VOICES, "vi")?.name).toBe("Microsoft HoaiMy Online (Natural) - Vietnamese (Vietnam)");
    expect(pickVoice([VOICES[4]], "vi")?.name).toBe("Linh");
    expect(pickVoice(VOICES, "en")?.name).toBe("Google UK English Female");
  });

  it("returns null when the device has no voice for the language", () => {
    expect(pickVoice(VOICES.slice(0, 2), "vi")).toBeNull();
  });
});

describe("speechChunks", () => {
  it("splits into sentences and breaks very long ones at commas", () => {
    expect(speechChunks("Chào bạn.  Hãy giới thiệu về bản thân! Bạn sẵn sàng chưa?")).toEqual([
      "Chào bạn.",
      "Hãy giới thiệu về bản thân!",
      "Bạn sẵn sàng chưa?",
    ]);
    const long = Array.from({ length: 12 }, (_, i) => `phần thứ ${i} của một câu rất dài`).join(", ");
    const chunks = speechChunks(long, 80);
    expect(chunks.length).toBeGreaterThan(3);
    expect(chunks.every((chunk) => chunk.length <= 80)).toBe(true);
    expect(chunks.join(" ")).toBe(long);
  });
});

describe("withSpokenText", () => {
  it("appends speech to what was typed", () => {
    expect(withSpokenText("Tôi nghĩ", " là nên dùng index ")).toBe("Tôi nghĩ là nên dùng index");
    expect(withSpokenText("", "Xin chào")).toBe("Xin chào");
  });
});
