import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import viDict from "@/i18n/dictionaries/vi.json";
import { buildCvDocument, type CvEdits } from "@/lib/export/document";
import { reviseResume } from "@/lib/export/revise";
import { makeAnalysis, makeResume } from "@/test/fixtures";
import { CvEditor } from "./cv-editor";

vi.mock("./cv-font", () => ({ cvFont: { className: "cv-font" } }));
vi.mock("@/lib/export/actions", () => ({ saveCvEdit: vi.fn() }));

function render(edits: CvEdits) {
  const analysis = makeAnalysis();
  analysis.bullet_suggestions[0] = { ...analysis.bullet_suggestions[0], proposed: "Cut latency by [X%]" };
  const revision = reviseResume(makeResume({ phone: null }), analysis, {
    bullets: { 0: { decision: "accepted", text: null } },
    summary: null,
  });
  return renderToStaticMarkup(
    <CvEditor
      analysisId="00000000-0000-4000-8000-000000000000"
      document={buildCvDocument(revision)}
      initialEdits={edits}
      appliedCount={revision.changed.size}
      unplacedCount={0}
      showPhotoNote={false}
      dict={viDict.cv}
    />,
  ).replaceAll("<!-- -->", "");
}

describe("CvEditor", () => {
  it("offers to add missing header fields and flags unfilled gaps", () => {
    const html = render({});

    expect(html).toContain(viDict.cv.addPhone);
    expect(html).toContain("Còn 1 dòng có chỗ trống");
    expect(html).toContain("bg-emerald-100");
    expect(html).toContain('href="/api/analyses/00000000-0000-4000-8000-000000000000/cv?format=pdf"');
  });

  it("shows hand edits, removed lines and the gaps they filled", () => {
    const html = render({
      "experience.0.b.0": { base: "Cut latency by [X%]", value: "Cut latency by 35%" },
      "experience.0.b.3": { base: "Mentored 3 junior engineers", value: "" },
    });

    expect(html).toContain("Cut latency by 35%");
    expect(html).toContain("bg-sky-100");
    expect(html).toContain(viDict.cv.removed);
    expect(html).toContain("Bạn đã tự sửa 2 chỗ.");
    expect(html).not.toContain("Còn 1 dòng có chỗ trống");
  });
});
