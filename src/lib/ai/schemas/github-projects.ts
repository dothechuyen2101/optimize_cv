import * as z from "zod";

export const GithubProjectsSchema = z.object({
  projects: z
    .array(
      z.object({
        repo: z.string().describe("The repository name exactly as given"),
        name: z.string().describe("Project title for the resume"),
        description: z.string().describe("One sentence: what it is and who it is for"),
        technologies: z.array(z.string()),
        bullets: z.array(z.string()).describe("2-4 resume lines"),
        matched_requirements: z.array(z.string()).describe("JD requirements this project gives evidence for"),
        reason: z.string().describe("Why this project helps for this job, 1-2 sentences"),
        new_skills: z
          .array(z.string())
          .describe("JD skills this repository demonstrates that the resume's skills list lacks"),
      }),
    )
    .describe("At most 4, most relevant first; empty if nothing fits"),
  skipped: z
    .array(z.object({ repo: z.string(), reason: z.string() }))
    .describe("At most 6 notable repositories not picked"),
});

export type GithubProjects = z.infer<typeof GithubProjectsSchema>;
