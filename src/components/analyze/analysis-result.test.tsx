import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import en from "@/i18n/dictionaries/en.json";
import viDict from "@/i18n/dictionaries/vi.json";
import type { AnalysisReport, Choices } from "@/lib/analysis/types";
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
    previous: null,
    ...overrides,
  };
}

const NONE: Choices = { bullets: {}, summary: null };

function render(report: AnalysisReport, dict = viDict.analyze, initialChoices = NONE) {
  return renderToStaticMarkup(
    <AnalysisResult
      report={report}
      dict={dict}
      newAnalysisHref="/vi/analyze"
      exportHref="/vi/analyses/x/cv"
      initialChoices={initialChoices}
    />,
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

  it("restores saved choices and counts them toward the export", () => {
    const html = render(makeReport(), viDict.analyze, {
      bullets: { 0: { decision: "accepted", text: null } },
      summary: { decision: "accepted", text: null },
    });
    expect(html).toContain("Đã chấp nhận 1/1 gợi ý");
    expect(html).toContain(viDict.analyze.result.copyAccepted);
    expect(html).toContain("Ghép 2 thay đổi bạn đã chấp nhận vào CV");
    expect(html).toContain('href="/vi/analyses/x/cv"');
  });

  it("shows the user's wording and asks them to fill remaining placeholders", () => {
    const analysis = makeAnalysis();
    analysis.bullet_suggestions[0] = { ...analysis.bullet_suggestions[0], proposed: "Cut latency by [X%]" };
    const filled = render(makeReport({ analysis }), viDict.analyze, {
      bullets: { 0: { decision: "accepted", text: "Cut latency by 35%" } },
      summary: null,
    });
    expect(filled).toContain("Cut latency by 35%");
    expect(filled).toContain("(đã sửa)");
    expect(filled).not.toContain("Điền [X%]");

    const unfilled = render(makeReport({ analysis }), viDict.analyze, {
      bullets: { 0: { decision: "accepted", text: null } },
      summary: null,
    });
    expect(unfilled).toContain("Điền [X%] bằng số liệu thật");
  });

  it("compares a re-evaluation with the analysis it came from", () => {
    const report = makeReport();
    const html = renderToStaticMarkup(
      <AnalysisResult
        report={{ ...report, previous: { id: "prev", overall: report.ats.overall - 12 } }}
        dict={viDict.analyze}
        newAnalysisHref="/vi/analyze"
        exportHref="/vi/analyses/x/cv"
        previousHref="/vi/analyses/prev"
      />,
    ).replaceAll("<!-- -->", "");

    expect(html).toContain(`So với lần đánh giá trước: ${report.ats.overall - 12} → ${report.ats.overall}`);
    expect(html).toContain("(+12)");
    expect(html).toContain('href="/vi/analyses/prev"');
    expect(render(report)).not.toContain("So với lần đánh giá trước");
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
