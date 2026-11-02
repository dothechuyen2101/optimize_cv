import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { CvDocument } from "@/lib/parsing/cv-document";
import { PARSE_CV_PROMPT } from "../prompts/parse-cv";
import { runStructuredStep } from "../run-step";
import { ResumeSchema } from "../schemas/resume";

export function parseCv(document: CvDocument) {
  const content: Anthropic.Beta.BetaContentBlockParam[] =
    document.kind === "pdf"
      ? [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: document.base64 } },
          { type: "text", text: "Extract this resume." },
        ]
      : [{ type: "text", text: `<resume>\n${document.text}\n</resume>\n\nExtract this resume.` }];

  return runStructuredStep({ step: "parse_cv", system: PARSE_CV_PROMPT.system, content, schema: ResumeSchema });
}
