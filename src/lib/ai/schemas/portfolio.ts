import * as z from "zod";

export const PortfolioReviewSchema = z.object({
  overall: z.number().int().describe("0-100: how strongly the portfolio supports getting an interview for this role"),
  verdict: z.string().describe("2-3 sentences"),
  rubric: z
    .object({
      relevance: z.number().int(),
      depth: z.number().int(),
      presentation: z.number().int(),
      credibility: z.number().int(),
      completeness: z.number().int(),
    })
    .describe("Each 1-5"),
  sources: z.array(z.object({ source: z.string(), summary: z.string(), issues: z.array(z.string()) })),
  strengths: z.array(z.string()),
  improvements: z
    .array(
      z.object({
        priority: z.enum(["high", "medium", "low"]),
        action: z.string(),
        why: z.string(),
        where: z.string().describe("The repository, page or slide to change"),
      }),
    )
    .describe("Ordered by impact for this role"),
  featured_picks: z.array(z.object({ item: z.string(), reason: z.string() })).describe("2-4 projects to show first"),
  missing_for_role: z.array(z.string()),
});

export type PortfolioReview = z.infer<typeof PortfolioReviewSchema>;
