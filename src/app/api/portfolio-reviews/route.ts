import { hasLocale } from "@/i18n/config";
import { aiErrorCode } from "@/lib/ai/errors";
import { AIStepError } from "@/lib/ai/run-step";
import { reviewPortfolio } from "@/lib/ai/steps/portfolio-review";
import { getAnalysisReport, recordUsage } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/billing/rate-limit";
import { CvFileRejected, MAX_PDF_PAGES, readPdfFile } from "@/lib/parsing/cv-document";
import { parseGithubTarget } from "@/lib/portfolio/fetch";
import { completePortfolioReview, failPortfolioReview, reservePortfolioReview } from "@/lib/portfolio/service";
import { isReadable, readSources } from "@/lib/portfolio/sources";
import { MAX_PORTFOLIO_PDF_BYTES, MAX_PORTFOLIO_URLS, type PortfolioErrorCode } from "@/lib/portfolio/types";

// Fetching the links and a strong-tier review usually take 40-90 seconds.
export const maxDuration = 180;

const fail = (code: PortfolioErrorCode, status = 400) => Response.json({ code }, { status });

function normalizeUrl(value: string): string | null {
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    return (url.protocol === "https:" || url.protocol === "http:") && withScheme.length <= 500 ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Reviews a portfolio against the job of the user's CV analysis. Multipart fields: analysisId,
 * lang, github (username or link), urls (up to 3, one per line) and pdf (optional file).
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return fail("unauthorized", 401);
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("invalid_request");
  }

  const analysisId = String(form.get("analysisId") ?? "");
  const lang = String(form.get("lang") ?? "");
  const github = String(form.get("github") ?? "").trim() || null;
  const rawUrls = String(form.get("urls") ?? "").split(/[\s,]+/).filter(Boolean);
  const file = form.get("pdf");
  const pdfFile = file instanceof File && file.size > 0 ? file : null;

  if (!github && rawUrls.length === 0 && !pdfFile) return fail("no_sources");
  if (rawUrls.length > MAX_PORTFOLIO_URLS) return fail("too_many_urls");
  const urls = rawUrls.map(normalizeUrl).filter((url): url is string => url !== null);
  if (urls.length !== rawUrls.length) return fail("invalid_url");
  if (github && !parseGithubTarget(github)) return fail("invalid_github");

  let pdf: Awaited<ReturnType<typeof readPdfFile>> | null = null;
  if (pdfFile) {
    try {
      pdf = await readPdfFile(pdfFile, MAX_PORTFOLIO_PDF_BYTES);
    } catch (error) {
      if (error instanceof CvFileRejected) return fail(error.code);
      throw error;
    }
    if ((pdf.pages ?? 0) > MAX_PDF_PAGES) return fail("too_many_pages");
  }

  if (await isRateLimited(user.id)) return fail("too_many_requests", 429);
  const found = await getAnalysisReport(user.id, analysisId);
  if (!found) return fail("invalid_request", 404);
  const reservation = await reservePortfolioReview(user.id, analysisId, {
    github,
    urls: urls,
    pdf: pdf?.fileName ?? null,
  });
  if (!reservation) return fail("invalid_request", 404);
  if ("quota" in reservation) return fail("quota_exceeded", 429);
  const { id } = reservation;

  try {
    const sources = await readSources(github, urls);
    if (!pdf && !sources.some(isReadable)) {
      // Nothing to review: no AI call, and failed reviews don't use quota.
      await failPortfolioReview(id, "sources_unreachable");
      return Response.json(
        { code: "sources_unreachable", sources: sources.map((s) => ({ label: s.label, error: "error" in s ? s.error : null })) },
        { status: 422 },
      );
    }
    const { job, resume } = found.report;
    const { output, usage } = await reviewPortfolio({
      job,
      resume,
      sources,
      pdf,
      uiLanguage: hasLocale(lang) ? lang : "vi",
    });
    await recordUsage(user.id, analysisId, usage);
    await completePortfolioReview(id, output);
    return Response.json({ id });
  } catch (error) {
    console.error("[portfolio] failed", error);
    const code = aiErrorCode(error);
    if (error instanceof AIStepError) await recordUsage(user.id, analysisId, error.usage).catch(() => {});
    await failPortfolioReview(id, code).catch(() => {});
    return fail(code, 502);
  }
}
