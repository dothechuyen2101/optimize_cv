import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { CvDocument } from "@/lib/parsing/cv-document";
import { groundResume } from "@/lib/parsing/ground";
import { PARSE_CV_PROMPT } from "../prompts/parse-cv";
import { runStructuredStep } from "../run-step";
import { ResumeSchema } from "../schemas/resume";

function content(document: CvDocument): Anthropic.Beta.BetaContentBlockParam[] {
  if (document.kind === "text") {
    return [{ type: "text", text: `<resume>\n${document.text}\n</resume>\n\nExtract this resume.` }];
  }
  const pdf: Anthropic.Beta.BetaContentBlockParam = {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: document.base64 },
  };
  if (document.text === null) return [pdf, { type: "text", text: "Extract this resume. It has no text layer." }];
  return [pdf, { type: "text", text: `<text_layer>\n${document.text}\n</text_layer>\n\nExtract this resume.` }];
}

export async function parseCv(document: CvDocument) {
  // Without a text layer every character is read off page images, which the fast model gets wrong too often.
  const step = document.kind === "pdf" && document.text === null ? "parse_cv_scan" : "parse_cv";
  const result = await runStructuredStep({
    step,
    system: PARSE_CV_PROMPT.system,
    content: content(document),
    schema: ResumeSchema,
  });
  if (document.text === null) return result;

  const { resume, corrected } = groundResume(result.output, document.text);
  if (corrected > 0) console.info(`[parse_cv] restored ${corrected} misread fields from the document text`);
  return { ...result, output: resume };
}
