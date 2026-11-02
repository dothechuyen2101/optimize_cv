import * as z from "zod";
import { ContentLanguageSchema } from "./resume";

export const JobTermSchema = z.object({
  term: z.string().describe("Short canonical name, as an ATS would match it"),
  aliases: z
    .array(z.string())
    .describe("Other ways a resume may state the same thing: translation, abbreviation, inflection, accepted alternative"),
});

export const JobSchema = z.object({
  title: z.string(),
  company: z.string().nullable(),
  seniority: z.enum(["intern", "junior", "mid", "senior", "lead", "manager", "director", "unknown"]),
  min_years_experience: z.number().nullable(),
  location: z.string().nullable(),
  work_mode: z.enum(["onsite", "hybrid", "remote", "unknown"]),
  required_skills: z
    .array(JobTermSchema)
    .describe("Hard skills, tools and qualifications the JD explicitly requires"),
  preferred_skills: z.array(JobTermSchema).describe("Nice-to-have skills; never repeats a required skill"),
  keywords: z
    .array(JobTermSchema)
    .describe("10-30 other terms an ATS would scan for: domain terms, methodologies, certifications"),
  responsibilities: z.array(z.string()),
  language_requirements: z.array(z.string()),
  detected_language: ContentLanguageSchema,
  market: z
    .enum(["vn", "international", "unknown"])
    .describe("vn if the role is based in Vietnam, international if based elsewhere"),
});

export type Job = z.infer<typeof JobSchema>;
export type JobTerm = z.infer<typeof JobTermSchema>;
