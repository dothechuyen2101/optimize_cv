import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import viDict from "@/i18n/dictionaries/vi.json";
import type { AnalysisReport } from "@/lib/analysis/types";
import { scoreAts } from "@/lib/ats/score";
import { makeAnalysis, makeJob, makeResume } from "@/test/fixtures";
import { AnalysisResult } from "./analysis-result";

function makeReport(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  const resume = makeResume();
  const job = makeJob();
  return {
    id: "00000000-0000-4000-8000-000000000000",
    resume,
    job,
    market: "vn",
    ats: scoreAts(resume, job, "vn"),
    analysis: makeAnalysis(),
    costUsd: 0.1234,
    ...overrides,
  };
}

function render(report: AnalysisReport, dict = viDict.analyze, initialDecisions = {}) {
  return renderToStaticMarkup(
    <AnalysisResult report={report} dict={dict} newAnalysisHref="/vi/analyze" initialDecisions={initialDecisions} />,
  );
}

describe("AnalysisResult", () => {
  it("renders the score, coverage chips and the suggestion with its resume context", () => {
    const report = makeReport();
    const html = render(report);

    expect(html).toContain(`${viDict.analyze.result.overall}: ${report.ats.overall}/100`);
    expect(html).toContain("Kinh nghiệm · Backend Engineer · Acme");
    expect(html).toContain("Designed and built REST APIs in Node.js and TypeScript serving 2M requests/day");
    expect(html).toContain("Đã chấp nhận 0/1 gợi ý");
    expect(html).toContain("Kubernetes");
    expect(html).toContain("Bạn đã từng triển khai ứng dụng lên Kubernetes chưa?");
  });

  it("falls back to the section label when a suggestion points past the resume", () => {
    const analysis = makeAnalysis();
    analysis.bullet_suggestions[0] = { ...analysis.bullet_suggestions[0], item_index: 7 };
    const html = render(makeReport({ analysis }), en.analyze);

    expect(html).toContain(">Experience<");
    expect(html).toContain("Accepted 0/1 suggestions");
  });

  it("restores saved decisions", () => {
    const html = render(makeReport(), viDict.analyze, { 0: "accepted" });
    expect(html).toContain("Đã chấp nhận 1/1 gợi ý");
    expect(html).toContain(viDict.analyze.result.copyAccepted);
  });

  it("shows the empty format state and hides empty optional sections", () => {
    const analysis = makeAnalysis({ market_notes: [], questions_for_user: [], keywords_to_add: [] });
    const report = makeReport({ analysis });
    report.ats = { ...report.ats, formatIssues: [] };
    const html = render(report);

    expect(html).toContain(viDict.analyze.result.noFormatIssues);
    expect(html).not.toContain(viDict.analyze.result.marketNotes);
    expect(html).not.toContain(viDict.analyze.result.questions);
  });
});
