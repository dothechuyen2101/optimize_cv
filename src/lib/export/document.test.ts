import mammoth from "mammoth";
import { describe, expect, it, vi } from "vitest";
import type { Choices } from "@/lib/analysis/types";
import { makeAnalysis, makeResume } from "@/test/fixtures";
import { applyCvEdits, buildCvDocument, cvFileName, cvTexts, pruneEmpty } from "./document";
import { renderCvDocx } from "./docx";
import { renderCvPdf } from "./pdf";
import { reviseResume } from "./revise";

vi.mock("server-only", () => ({}));

const ACCEPT_FIRST: Choices = { bullets: { 0: { decision: "accepted", text: null } }, summary: null };

function vietnameseDocument(choices = ACCEPT_FIRST) {
  const resume = makeResume({
    detected_language: "vi",
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/nguyen-van-a/" }],
    projects: [{ name: "Ví điện tử", role: null, description: null, bullets: [], technologies: ["Go", "Kafka"] }],
    certifications: [],
  });
  return buildCvDocument(reviseResume(resume, makeAnalysis(), choices));
}

describe("buildCvDocument", () => {
  it("lays the resume out in its own language and marks rewritten lines", () => {
    const doc = vietnameseDocument();

    expect(doc.sections.map((s) => s.heading)).toEqual([
      "Tóm tắt",
      "Kinh nghiệm làm việc",
      "Dự án",
      "Học vấn",
      "Kỹ năng",
      "Ngoại ngữ",
    ]);
    const job = doc.sections[1].entries[0];
    expect(job).toMatchObject({ title: { text: "Backend Engineer" }, subtitle: { text: "Acme" }, dates: { text: "2021 – Hiện tại" } });
    expect(job.bullets.map((b) => b.changed)).toEqual([true, false, false, false]);
    expect(doc.sections[2].entries[0].paragraphs[0].text).toBe("Công nghệ: Go, Kafka");
    expect(doc.contact.map((c) => c.text)).toEqual(["a@example.com", "0900000000", "Hồ Chí Minh", "linkedin.com/in/nguyen-van-a"]);
  });

  it("gives every piece of text a stable key", () => {
    const doc = vietnameseDocument();
    const keys = cvTexts(doc).map((t) => t.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("contact.phone");
    expect(doc.sections[1].entries[0].bullets[2].key).toBe("experience.0.b.2");
    expect(cvTexts(vietnameseDocument({ bullets: {}, summary: null })).map((t) => t.key)).toEqual(keys);
  });

  it("uses English headings for other languages", () => {
    const doc = buildCvDocument(reviseResume(makeResume(), makeAnalysis(), { bullets: {}, summary: null }));
    expect(doc.sections[1]).toMatchObject({ heading: "Experience", entries: [{ dates: { text: "2021 – Present" } }] });
  });
});

describe("hand edits", () => {
  it("apply while the CV still shows the text they replaced", () => {
    const doc = applyCvEdits(vietnameseDocument(), {
      "contact.phone": { base: "0900000000", value: "0911222333" },
      // Edited before the suggestion on this line was accepted, so it no longer applies.
      "experience.0.b.0": { base: "Built REST APIs in Node.js serving 2M requests/day", value: "Stale edit" },
    });

    expect(doc.contact[1]).toMatchObject({ text: "0911222333", edited: true });
    expect(doc.sections[1].entries[0].bullets[0]).toMatchObject({
      text: "Designed and built REST APIs in Node.js and TypeScript serving 2M requests/day",
      edited: false,
    });
  });

  it("leave cleared lines and emptied sections out of the export", () => {
    const doc = pruneEmpty(
      applyCvEdits(vietnameseDocument(), {
        "summary.0.p.0": { base: "Backend engineer with 4 years building APIs.", value: "" },
        "experience.0.b.3": { base: "Mentored 3 junior engineers", value: "" },
        "contact.location": { base: "Hồ Chí Minh", value: "" },
      }),
    );

    expect(doc.sections[0].heading).toBe("Kinh nghiệm làm việc");
    expect(doc.sections[0].entries[0].bullets).toHaveLength(3);
    expect(doc.contact.map((c) => c.text)).toEqual(["a@example.com", "0900000000", "linkedin.com/in/nguyen-van-a"]);
  });
});

describe("cvFileName", () => {
  it("builds an ASCII file name", () => {
    expect(cvFileName("Đỗ Thị Hương", "AI Product Evaluator / Contractor", "pdf")).toBe(
      "CV-Do-Thi-Huong-AI-Product-Evaluator-Contractor.pdf",
    );
    expect(cvFileName(null, null, "docx")).toBe("CV.docx");
  });
});

describe("renderers", () => {
  it("writes a Word file with the Vietnamese text and the accepted rewrite", async () => {
    const { value } = await mammoth.extractRawText({ buffer: await renderCvDocx(pruneEmpty(vietnameseDocument())) });

    expect(value).toContain("Nguyễn Văn A");
    expect(value).toContain("Kinh nghiệm làm việc");
    expect(value).toContain("Designed and built REST APIs in Node.js and TypeScript serving 2M requests/day");
    expect(value).not.toContain("Built REST APIs in Node.js serving 2M requests/day");
  });

  it("writes a PDF with the Vietnamese font embedded", async () => {
    const pdf = await renderCvPdf(pruneEmpty(vietnameseDocument()));

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("BeVietnamPro");
  });
});
