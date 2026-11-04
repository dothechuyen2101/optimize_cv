import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import viDict from "@/i18n/dictionaries/vi.json";
import type { ProjectImportResult } from "@/lib/projects/types";
import { ProjectProposals } from "./project-proposals";

vi.mock("@/lib/projects/actions", () => ({ saveProjectDecisions: vi.fn() }));

const RESULT: ProjectImportResult = {
  owner: "kiem-thu",
  considered: 6,
  proposals: [
    {
      repo: "orders-service",
      url: "https://github.com/kiem-thu/orders-service",
      name: "Dịch vụ đơn hàng",
      description: "Microservice xử lý đơn hàng cho shop online.",
      technologies: ["Node.js", "Kubernetes"],
      bullets: ["Xây dựng API đơn hàng bằng Node.js phục vụ [X] đơn mỗi ngày", "Triển khai lên Kubernetes"],
      matched_requirements: ["Kubernetes", "Microservices"],
      reason: "Cho thấy kinh nghiệm Kubernetes mà CV đang thiếu.",
      new_skills: ["Kubernetes"],
    },
    {
      repo: "chat-app",
      url: "https://github.com/kiem-thu/chat-app",
      name: "Ứng dụng chat",
      description: "Chat thời gian thực.",
      technologies: ["WebSocket"],
      bullets: ["Xây dựng chat thời gian thực bằng WebSocket"],
      matched_requirements: [],
      reason: "Liên quan tới realtime.",
      new_skills: [],
    },
  ],
  skipped: [{ repo: "dotfiles-old", reason: "Chỉ là cấu hình máy" }],
};

function render(decisions: Record<string, "accepted" | "rejected">) {
  return renderToStaticMarkup(
    <ProjectProposals
      analysisId="00000000-0000-4000-8000-000000000000"
      result={RESULT}
      initialDecisions={decisions}
      cvHref="/vi/analyses/x/cv"
      dict={viDict.projects}
    />,
  ).replaceAll("<!-- -->", "");
}

describe("ProjectProposals", () => {
  it("shows each project with its evidence and the way to the new CV", () => {
    const html = render({});
    expect(html).toContain("0/2 dự án đã đưa vào CV.");
    expect(html).toContain("Đưa tất cả vào CV");
    expect(html).toContain('href="/vi/analyses/x/cv"');
    expect(html).toContain('href="https://github.com/kiem-thu/orders-service"');
    expect(html).toContain("Cho thấy kinh nghiệm Kubernetes mà CV đang thiếu.");
    expect(html).toContain("Kỹ năng sẽ thêm vào CV");
    expect(html).toContain("Repo không dùng (1)");
    // The placeholder is highlighted for the user to fill.
    expect(html).toMatch(/<mark[^>]*>\[X\]<\/mark>/);
  });

  it("reflects the user's calls and warns about gaps in accepted projects", () => {
    const html = render({ 0: "accepted", 1: "rejected" });
    expect(html).toContain("1/2 dự án đã đưa vào CV.");
    expect(html).toContain("Đã đưa vào CV");
    expect(html).toContain("Đã bỏ qua");
    expect(html).not.toContain("Đưa tất cả vào CV");
    expect(html).toContain(viDict.projects.placeholders.replace("&", "&amp;"));
  });

  it("explains why nothing was picked when there are no proposals", () => {
    const html = renderToStaticMarkup(
      <ProjectProposals
        analysisId="00000000-0000-4000-8000-000000000000"
        result={{ ...RESULT, proposals: [] }}
        initialDecisions={{}}
        cvHref="/vi/analyses/x/cv"
        dict={viDict.projects}
      />,
    );
    expect(html).toContain("Không có repo nào đủ liên quan");
    expect(html).not.toContain('href="/vi/analyses/x/cv"');
    expect(html).toContain("<details open");
    expect(html).toContain("Chỉ là cấu hình máy");
  });
});
