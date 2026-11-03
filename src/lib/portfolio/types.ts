import type { AnalysisErrorCode } from "@/lib/analysis/types";

export const MAX_PORTFOLIO_URLS = 3;
/** Vercel caps request bodies at 4.5 MB, so larger PDFs couldn't arrive anyway. */
export const MAX_PORTFOLIO_PDF_BYTES = 4 * 1024 * 1024;

export type PortfolioErrorCode =
  | AnalysisErrorCode
  | "no_sources"
  | "too_many_urls"
  | "invalid_url"
  | "invalid_github"
  | "sources_unreachable"
  | "too_many_pages";
