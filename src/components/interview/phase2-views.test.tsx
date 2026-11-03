import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RoleReportView } from "@/components/role/role-report-view";
import viDict from "@/i18n/dictionaries/vi.json";
import type { InterviewReport } from "@/lib/ai/schemas/interview";
import type { RoleReport } from "@/lib/ai/schemas/role";
import type { StoredTurn } from "@/lib/interview/service";
import { InterviewChat } from "./interview-chat";

const ROLE: RoleReport = {
  summary: "Xây dựng và vận hành API backend cho sản phẩm thanh toán.",
  responsibilities: [{ area: "Thiết kế API", detail: "REST API cho ví điện tử" }],
  must_have: [{ item: "Node.js", evidence_in_jd: "3+ năm Node.js" }],
  nice_to_have: [],
  seniority: { level: "Senior", signals: ["5+ năm kinh nghiệm"] },
  unknowns: ["Quy mô team"],
  interview_rounds: [{ name: "Vòng kỹ thuật", focus: "System design", how_to_prepare: "Ôn thiết kế hệ thống chịu tải" }],
  practice_questions: [
    { category: "technical", question: "Bạn tối ưu truy vấn PostgreSQL thế nào?", why_asked: "Kiểm tra chiều sâu", answer_tips: "Kể vụ giảm 40% thời gian truy vấn" },
  ],
  your_angle: { strengths_to_highlight: ["API 2 triệu request/ngày"], gaps_to_prepare: ["Kubernetes"] },
  questions_to_ask: ["Team có on-call không?"],
};

const REPORT: InterviewReport = {
  overall: 72,
  verdict: "Trả lời rõ ràng nhưng thiếu số liệu.",
  rubric: { structure: 4, relevance: 4, evidence: 3, communication: 4 },
  per_question: [{ question: "Kể về một dự án khó", score: 3, comment: "Thiếu kết quả đo được." }],
  top_improvements: ["Thêm số liệu cụ thể"],
  strongest_moment: null,
  improved_answer: { question: "Kể về một dự án khó", answer: "Tôi đã giảm [X%] độ trễ…" },
};

const TURNS: StoredTurn[] = [
  { position: 0, role: "interviewer", kind: "question", content: "Chào bạn, hãy giới thiệu về bản thân.", feedback: null },
  {
    position: 1,
    role: "candidate",
    content: "Tôi là kỹ sư backend 4 năm.",
    feedback: { score: 3, strengths: ["Ngắn gọn"], improvements: ["Nêu thành tựu"], better_answer_outline: "Nêu dự án API 2 triệu request/ngày" },
  },
  { position: 2, role: "interviewer", kind: "follow_up", content: "Thành tựu bạn tự hào nhất?", feedback: null },
];

function chat(report: InterviewReport | null, turns = TURNS) {
  return renderToStaticMarkup(
    <InterviewChat
      sessionId="s1"
      initialTurns={turns}
      initialReport={report}
      newSessionHref="/vi/analyses/a1/interview"
      dict={viDict.interview}
      errors={viDict.analyze.errors}
    />,
  ).replaceAll("<!-- -->", "");
}

describe("RoleReportView", () => {
  it("renders every part of the report", () => {
    const html = renderToStaticMarkup(<RoleReportView report={ROLE} dict={viDict.role} />);
    for (const text of [ROLE.summary, "Cấp độ: Senior", "Trong JD: 3+ năm Node.js", "Vòng kỹ thuật", "Kỹ thuật", "Kubernetes", "Team có on-call không?"]) {
      expect(html).toContain(text);
    }
    // Empty sections are left out.
    expect(html).not.toContain(viDict.role.niceToHave);
  });
});

describe("InterviewChat", () => {
  it("shows the conversation with feedback and lets the candidate answer or finish", () => {
    const html = chat(null);

    expect(html).toContain("Chào bạn, hãy giới thiệu về bản thân.");
    expect(html).toContain("3/5");
    expect(html).toContain("Nêu dự án API 2 triệu request/ngày");
    expect(html).toContain(viDict.interview.placeholder);
    expect(html).toContain(viDict.interview.finish);
  });

  it("offers no finish before the first answer", () => {
    expect(chat(null, TURNS.slice(0, 1))).not.toContain(viDict.interview.finish);
  });

  it("shows the report and no input once scored", () => {
    const html = chat(REPORT);

    expect(html).toContain(viDict.interview.reportTitle);
    expect(html).toContain("72/100");
    expect(html).toContain("Tôi đã giảm [X%] độ trễ…");
    expect(html).not.toContain(viDict.interview.placeholder);
    expect(html).toContain('href="/vi/analyses/a1/interview"');
  });
});
