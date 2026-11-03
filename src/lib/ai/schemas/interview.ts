import * as z from "zod";

export const InterviewTypeSchema = z.enum(["behavioral", "technical", "hr", "mixed"]);
export const InterviewDifficultySchema = z.enum(["easy", "normal", "hard"]);
export type InterviewType = z.infer<typeof InterviewTypeSchema>;
export type InterviewDifficulty = z.infer<typeof InterviewDifficultySchema>;

export const AnswerFeedbackSchema = z.object({
  score: z.number().int().describe("1-5"),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  better_answer_outline: z.string().nullable(),
});

export type AnswerFeedback = z.infer<typeof AnswerFeedbackSchema>;

export const InterviewTurnSchema = z.object({
  feedback: AnswerFeedbackSchema.nullable().describe(
    "Coaching on the candidate's last answer when feedback is on and the transcript ends with an answer; otherwise null",
  ),
  kind: z.enum(["question", "follow_up", "closing"]),
  message: z.string().describe("What the interviewer says next, in the interview language"),
});

export type InterviewTurn = z.infer<typeof InterviewTurnSchema>;

export const InterviewReportSchema = z.object({
  overall: z.number().int().describe("0-100"),
  verdict: z.string().describe("2-3 sentences"),
  rubric: z
    .object({
      structure: z.number().int(),
      relevance: z.number().int(),
      evidence: z.number().int(),
      communication: z.number().int(),
    })
    .describe("Each 1-5"),
  per_question: z.array(z.object({ question: z.string(), score: z.number().int().describe("1-5"), comment: z.string() })),
  top_improvements: z.array(z.string()),
  strongest_moment: z.string().nullable(),
  improved_answer: z
    .object({ question: z.string(), answer: z.string() })
    .nullable()
    .describe("The weakest answer rewritten, using only facts the candidate stated or the resume shows"),
});

export type InterviewReport = z.infer<typeof InterviewReportSchema>;
