import * as z from "zod";

export const PracticeCategorySchema = z.enum(["behavioral", "technical", "role", "hr"]);

export const RoleReportSchema = z.object({
  summary: z.string().describe("2-3 sentences: what this job really is, day to day"),
  responsibilities: z
    .array(z.object({ area: z.string(), detail: z.string() }))
    .describe("3-6 areas the work actually splits into, decoded from the JD's wording"),
  must_have: z.array(z.object({ item: z.string(), evidence_in_jd: z.string() })),
  nice_to_have: z.array(z.object({ item: z.string(), evidence_in_jd: z.string() })),
  seniority: z.object({ level: z.string(), signals: z.array(z.string()) }),
  unknowns: z.array(z.string()).describe("What the JD leaves unclear that the candidate should find out"),
  interview_rounds: z
    .array(z.object({ name: z.string(), focus: z.string(), how_to_prepare: z.string() }))
    .describe("3-5 rounds roles like this typically have, in order; not facts about this company"),
  practice_questions: z.array(
    z.object({
      category: PracticeCategorySchema,
      question: z.string(),
      why_asked: z.string(),
      answer_tips: z.string(),
    }),
  ),
  your_angle: z.object({
    strengths_to_highlight: z.array(z.string()),
    gaps_to_prepare: z.array(z.string()),
  }),
  questions_to_ask: z.array(z.string()).describe("4-6 questions the candidate can ask the interviewers"),
});

export type RoleReport = z.infer<typeof RoleReportSchema>;
