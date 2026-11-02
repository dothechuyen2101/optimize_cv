import mammoth from "mammoth";
import { describe, expect, it, vi } from "vitest";
import { makeAnalysis, makeResume } from "@/test/fixtures";
import { buildCvDocument, cvFileName } from "./document";
import { renderCvDocx } from "./docx";
import { renderCvPdf } from "./pdf";
import { reviseResume } from "./revise";

vi.mock("server-only", () => ({}));

const accepted = { decision: "accepted", text: null } as const;

function vietnameseDocument() {
  const resume = makeResume({
    detected_language: "vi",
    links: [{ label: "LinkedIn", url: "https://www.linkedin.com/in/nguyen-van-a/" }],
    projects: [{ name: "Ví điện tử", role: null, description: null, bullets: [], technologies: ["Go", "Kafka"] }],
    certifications: [],
  });
  return buildCvDocument(reviseResume(resume, makeAnalysis(), { bullets: { 0: accepted }, summary: null }));
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
    expect(job).toMatchObject({ title: "Backend Engineer", subtitle: "Acme", dates: "2021 – Hiện tại" });
    expect(job.bullets.map((b) => b.changed)).toEqual([true, false, false, false]);
    expect(doc.sections[2].entries[0].paragraphs[0].text).toBe("Công nghệ: Go, Kafka");
    expect(doc.contact).toEqual(["a@example.com", "0900000000", "Hồ Chí Minh", "linkedin.com/in/nguyen-van-a"]);
  });

  it("uses English headings for other languages", () => {
    const doc = buildCvDocument(reviseResume(makeResume(), makeAnalysis(), { bullets: {}, summary: null }));
    expect(doc.sections[1]).toMatchObject({ heading: "Experience", entries: [{ dates: "2021 – Present" }] });
  });
});

describe("cvFileName", () => {
  it("builds an ASCII file name", () => {
    expect(cvFileName("Đỗ Thế Chuyên", "AI Product Evaluator / Contractor", "pdf")).toBe(
      "CV-Do-The-Chuyen-AI-Product-Evaluator-Contractor.pdf",
    );
    expect(cvFileName(null, null, "docx")).toBe("CV.docx");
  });
});

describe("renderers", () => {
  it("writes a Word file with the Vietnamese text and the accepted rewrite", async () => {
    const { value } = await mammoth.extractRawText({ buffer: await renderCvDocx(vietnameseDocument()) });

    expect(value).toContain("Nguyễn Văn A");
    expect(value).toContain("Kinh nghiệm làm việc");
    expect(value).toContain("Designed and built REST APIs in Node.js and TypeScript serving 2M requests/day");
    expect(value).not.toContain("Built REST APIs in Node.js serving 2M requests/day");
  });

  it("writes a PDF with the Vietnamese font embedded", async () => {
    const pdf = await renderCvPdf(vietnameseDocument());

    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.toString("latin1")).toContain("BeVietnamPro");
  });
});
