import type { Analysis } from "@/lib/ai/schemas/analysis";
import type { Job, JobTerm } from "@/lib/ai/schemas/job";
import type { Resume } from "@/lib/ai/schemas/resume";

export function makeResume(overrides: Partial<Resume> = {}): Resume {
  return {
    full_name: "Nguyễn Văn A",
    headline: "Backend Engineer",
    email: "a@example.com",
    phone: "0900000000",
    location: "Hồ Chí Minh",
    links: [],
    summary: "Backend engineer with 4 years building APIs.",
    total_years_experience: 4,
    experiences: [
      {
        title: "Backend Engineer",
        company: "Acme",
        location: null,
        start_date: "2021",
        end_date: null,
        is_current: true,
        bullets: [
          "Built REST APIs in Node.js serving 2M requests/day",
          "Cut PostgreSQL query time by 40%",
          "Set up CI/CD pipelines on GitHub Actions",
          "Mentored 3 junior engineers",
        ],
      },
    ],
    projects: [],
    education: [
      { school: "HCMUT", degree: "BSc", field: "Computer Science", start_date: null, end_date: null, gpa: null },
    ],
    skills: ["Node.js", "TypeScript", "PostgreSQL", "Docker"],
    certifications: [],
    languages: [{ language: "English", proficiency: "IELTS 7.0" }],
    other_sections: [],
    has_photo: false,
    has_date_of_birth: false,
    detected_language: "en",
    ...overrides,
  };
}

/** JD terms without aliases. */
export function terms(...names: string[]): JobTerm[] {
  return names.map((term) => ({ term, aliases: [] }));
}

export function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    title: "Senior Backend Engineer",
    company: "Example",
    seniority: "senior",
    min_years_experience: 5,
    location: "Hà Nội",
    work_mode: "hybrid",
    required_skills: terms("NodeJS", "PostgreSQL", "Kubernetes"),
    preferred_skills: terms("TypeScript"),
    keywords: terms("REST API", "CI/CD", "microservices", "Agile"),
    responsibilities: [],
    language_requirements: [],
    detected_language: "en",
    market: "vn",
    ...overrides,
  };
}

export function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    verdict: "Hồ sơ khá phù hợp nhưng thiếu Kubernetes.",
    strengths: ["Kinh nghiệm Node.js và PostgreSQL rõ ràng"],
    gaps: [
      {
        requirement: "Kubernetes",
        severity: "critical",
        evidence_in_cv: null,
        advice: "Nếu đã từng dùng Kubernetes, hãy nêu rõ trong kinh nghiệm.",
      },
    ],
    bullet_suggestions: [
      {
        section: "experience",
        item_index: 0,
        bullet_index: 0,
        original: "Built REST APIs in Node.js serving 2M requests/day",
        proposed: "Designed and built REST APIs in Node.js and TypeScript serving 2M requests/day",
        reason: "Thêm TypeScript, một kỹ năng JD ưu tiên.",
        keywords_added: ["TypeScript"],
        needs_user_confirmation: false,
        confirmation_question: null,
      },
    ],
    summary_rewrite: {
      original: "Backend engineer with 4 years building APIs.",
      proposed: "Backend engineer with 4 years building high-traffic REST APIs in Node.js and PostgreSQL.",
      reason: "Nêu rõ công nghệ JD yêu cầu.",
    },
    keywords_to_add: [{ keyword: "Kubernetes", where: "Kỹ năng", only_if_true: true }],
    questions_for_user: ["Bạn đã từng triển khai ứng dụng lên Kubernetes chưa?"],
    market_notes: [],
    ...overrides,
  };
}
