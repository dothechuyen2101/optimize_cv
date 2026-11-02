import * as z from "zod";

// Structured outputs reject numeric/string length constraints, so the schemas
// rely on `.describe()` to steer the model instead.

export const ContentLanguageSchema = z.enum(["vi", "en", "other"]);

export const ResumeSchema = z.object({
  full_name: z.string().nullable(),
  headline: z.string().nullable().describe("Title line under the name, as written"),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  location: z.string().nullable(),
  links: z.array(z.object({ label: z.string(), url: z.string() })),
  summary: z.string().nullable().describe("Summary / objective / profile paragraph, verbatim"),
  total_years_experience: z
    .number()
    .nullable()
    .describe("Estimated years of professional work experience; overlapping periods count once"),
  experiences: z.array(
    z.object({
      title: z.string(),
      company: z.string(),
      location: z.string().nullable(),
      start_date: z.string().nullable().describe("As written in the resume"),
      end_date: z.string().nullable().describe("As written; null if current"),
      is_current: z.boolean(),
      bullets: z.array(z.string()).describe("Each responsibility/achievement line, verbatim"),
    }),
  ),
  projects: z.array(
    z.object({
      name: z.string(),
      role: z.string().nullable(),
      description: z.string().nullable(),
      bullets: z.array(z.string()),
      technologies: z.array(z.string()),
    }),
  ),
  education: z.array(
    z.object({
      school: z.string(),
      degree: z.string().nullable(),
      field: z.string().nullable(),
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
      gpa: z.string().nullable(),
    }),
  ),
  skills: z.array(z.string()).describe("Every skill/tool listed, one per item"),
  certifications: z.array(z.string()),
  languages: z.array(z.object({ language: z.string(), proficiency: z.string().nullable() })),
  other_sections: z.array(z.object({ title: z.string(), content: z.string() })),
  has_photo: z.boolean().describe("True only if the document visibly contains a photo of the candidate"),
  has_date_of_birth: z.boolean(),
  detected_language: ContentLanguageSchema.describe("Main language of the resume text"),
});

export type Resume = z.infer<typeof ResumeSchema>;
