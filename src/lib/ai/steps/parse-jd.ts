import "server-only";
import { PARSE_JD_PROMPT } from "../prompts/parse-jd";
import { runStructuredStep } from "../run-step";
import { JobSchema } from "../schemas/job";

export function parseJd(jdText: string) {
  return runStructuredStep({
    step: "parse_jd",
    system: PARSE_JD_PROMPT.system,
    content: [{ type: "text", text: `<job_description>\n${jdText}\n</job_description>\n\nExtract this job description.` }],
    schema: JobSchema,
  });
}
