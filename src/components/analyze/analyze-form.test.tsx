import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import viDict from "@/i18n/dictionaries/vi.json";
import type { SavedJob } from "@/lib/analysis/types";
import { AnalyzeForm, type SavedJobOption } from "./analyze-form";

vi.mock("@/lib/analysis/actions", () => ({ loadSavedJob: vi.fn() }));

const SAVED: SavedJobOption[] = [
  { analysisId: "a1", title: "Senior Backend Engineer", company: "Example", usedAt: "2 thg 11, 2026" },
  { analysisId: "a2", title: null, company: null, usedAt: "1 thg 11, 2026" },
];

function render(initialJob: SavedJob | null, savedJobs = SAVED) {
  return renderToStaticMarkup(
    <AnalyzeForm
      dict={viDict.analyze}
      running={false}
      locked={false}
      stage={null}
      savedJobs={savedJobs}
      initialJob={initialJob}
      onSubmit={() => {}}
    />,
  ).replaceAll("<!-- -->", "");
}

describe("AnalyzeForm", () => {
  it("lists saved JDs to pick from", () => {
    const html = render(null);

    expect(html).toContain(viDict.analyze.savedJobsPlaceholder);
    expect(html).toContain("Senior Backend Engineer · Example — 2 thg 11, 2026");
    expect(html).toContain(viDict.analyze.savedJobUntitled);
    expect(html).not.toContain("Đang dùng JD đã lưu");
  });

  it("starts from a saved JD, with its market, and says the result will be compared", () => {
    const jd = "Senior Backend Engineer at Example. Node.js, PostgreSQL, Kubernetes.";
    const html = render({ analysisId: "a1", jd, market: "vn", title: "Senior Backend Engineer", company: "Example" });

    expect(html).toContain(`>${jd}</textarea>`);
    expect(html).toMatch(/<option value="vn" selected="">/);
    expect(html).toMatch(/<option value="a1" selected="">/);
    expect(html).toContain("Đang dùng JD đã lưu: Senior Backend Engineer · Example.");
  });

  it("hides the picker when there is no history", () => {
    expect(render(null, [])).not.toContain(viDict.analyze.savedJobs);
  });
});
