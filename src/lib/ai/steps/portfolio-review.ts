import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { Locale } from "@/i18n/config";
import type { PortfolioSource } from "@/lib/portfolio/sources";
import { PORTFOLIO_REVIEW_PROMPT } from "../prompts/portfolio-review";
import { runStructuredStep } from "../run-step";
import type { Job } from "../schemas/job";
import { PortfolioReviewSchema } from "../schemas/portfolio";
import type { Resume } from "../schemas/resume";

export interface PortfolioReviewInput {
  job: Job;
  resume: Resume;
  sources: PortfolioSource[];
  pdf: { fileName: string; base64: string; text: string | null } | null;
  uiLanguage: Locale;
}

export function reviewPortfolio({ job, resume, sources, pdf, uiLanguage }: PortfolioReviewInput) {
  const payload = {
    target: { job, resume },
    sources,
    pdf: pdf?.fileName ?? null,
    settings: { ui_language: uiLanguage },
  };
  const content: Anthropic.Beta.BetaContentBlockParam[] = [{ type: "text", text: JSON.stringify(payload) }];
  if (pdf) {
    // Design portfolios are mostly images, so the model gets the pages; the text layer helps it quote exactly.
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf.base64 } });
    if (pdf.text) content.push({ type: "text", text: `<pdf_text_layer>\n${pdf.text}\n</pdf_text_layer>` });
  }
  content.push({ type: "text", text: "Review this portfolio." });

  return runStructuredStep({
    step: "portfolio_review",
    system: PORTFOLIO_REVIEW_PROMPT.system,
    content,
    schema: PortfolioReviewSchema,
  });
}
