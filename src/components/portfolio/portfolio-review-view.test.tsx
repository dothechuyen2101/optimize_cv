import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import viDict from "@/i18n/dictionaries/vi.json";
import type { PortfolioReview } from "@/lib/ai/schemas/portfolio";
import { PortfolioReviewView } from "./portfolio-review-view";

const REVIEW: PortfolioReview = {
  overall: 58,
  verdict: "Có dự án backend phù hợp nhưng README sơ sài.",
  rubric: { relevance: 4, depth: 2, presentation: 2, credibility: 3, completeness: 3 },
  sources: [{ source: "github.com/octocat", summary: "8 repo, ít hoạt động gần đây.", issues: ["README không có hướng dẫn chạy"] }],
  strengths: ["Có repo Node.js"],
  improvements: [{ priority: "high", action: "Viết lại README repo payment-api", why: "Nhà tuyển dụng đọc README trước", where: "github.com/octocat/payment-api" }],
  featured_picks: [{ item: "payment-api", reason: "Đúng stack của JD" }],
  missing_for_role: [],
};

describe("PortfolioReviewView", () => {
  it("renders the score, prioritized actions and sources", () => {
    const html = renderToStaticMarkup(<PortfolioReviewView review={REVIEW} dict={viDict.portfolio} />).replaceAll("<!-- -->", "");

    expect(html).toContain("58/100");
    expect(html).toContain("Ưu tiên cao");
    expect(html).toContain("Sửa ở đâu: github.com/octocat/payment-api");
    expect(html).toContain("README không có hướng dẫn chạy");
    expect(html).toContain("Đúng stack của JD");
    // Empty sections are left out.
    expect(html).not.toContain(viDict.portfolio.missing);
  });
});
