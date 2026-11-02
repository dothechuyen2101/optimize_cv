import * as z from "zod";

export const AnalysisSchema = z.object({
  verdict: z.string().describe("2-3 sentences: how competitive this resume is for this JD and the single biggest fix"),
  strengths: z.array(z.string()),
  gaps: z.array(
    z.object({
      requirement: z.string(),
      severity: z.enum(["critical", "major", "minor"]),
      evidence_in_cv: z.string().nullable().describe("Closest related evidence in the resume, or null if none"),
      advice: z.string(),
    }),
  ),
  bullet_suggestions: z.array(
    z.object({
      section: z.enum(["experience", "project"]),
      item_index: z.number().int().describe("0-based index into resume.experiences or resume.projects"),
      bullet_index: z.number().int().describe("0-based index into that item's bullets"),
      original: z.string(),
      proposed: z.string(),
      reason: z.string(),
      keywords_added: z.array(z.string()),
      needs_user_confirmation: z
        .boolean()
        .describe("True when the rewrite contains a placeholder or a claim the user must verify"),
      confirmation_question: z.string().nullable(),
    }),
  ),
  summary_rewrite: z.object({
    original: z.string().nullable(),
    proposed: z.string(),
    reason: z.string(),
  }),
  keywords_to_add: z.array(
    z.object({
      keyword: z.string(),
      where: z.string().describe("Which section to add it to"),
      only_if_true: z.boolean().describe("True when the resume does not prove the user has this skill"),
    }),
  ),
  questions_for_user: z.array(z.string()),
  market_notes: z.array(z.string()),
});

export type Analysis = z.infer<typeof AnalysisSchema>;
export type BulletSuggestion = Analysis["bullet_suggestions"][number];
