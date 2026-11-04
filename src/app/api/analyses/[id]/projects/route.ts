import { hasLocale } from "@/i18n/config";
import { aiErrorCode } from "@/lib/ai/errors";
import { AIStepError } from "@/lib/ai/run-step";
import { writeGithubProjects } from "@/lib/ai/steps/github-projects";
import { getAnalysisReport, recordUsage } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/billing/rate-limit";
import { SourceFetchError, listGithubRepos, withReadmes, type GithubRepo } from "@/lib/portfolio/fetch";
import { parseGithubTarget } from "@/lib/portfolio/github-target";
import { README_CHARS, finalizeProposals, rankRepos } from "@/lib/projects/select";
import { claimProjectImport, completeProjectImport, failProjectImport, getProjectImport } from "@/lib/projects/service";
import type { ProjectsErrorCode } from "@/lib/projects/types";

export const maxDuration = 120;

function githubErrorCode(error: unknown): ProjectsErrorCode {
  if (error instanceof SourceFetchError && error.code === "not_found") return "github_not_found";
  if (error instanceof SourceFetchError && error.code === "rate_limited") return "github_rate_limited";
  return "github_unreachable";
}

function fail(code: ProjectsErrorCode, status: number) {
  return Response.json({ code }, { status });
}

/**
 * Writes resume projects from the user's GitHub repositories for their CV analysis, once; a failed
 * run or one that found nothing can be retried. Body: { github, lang } with lang the UI language.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/analyses/[id]/projects">) {
  const user = await getSessionUser();
  if (!user) return fail("unauthorized", 401);
  const { id } = await ctx.params;
  const found = await getAnalysisReport(user.id, id);
  if (!found) return fail("invalid_request", 404);

  const body = (await request.json().catch(() => null)) as { github?: unknown; lang?: unknown } | null;
  const source = typeof body?.github === "string" ? body.github.trim().slice(0, 200) : "";
  const target = parseGithubTarget(source);
  if (!target) return fail("invalid_github", 400);
  const lang = typeof body?.lang === "string" && hasLocale(body.lang) ? body.lang : "vi";

  if (await isRateLimited(user.id)) return fail("too_many_requests", 429);
  if (!(await claimProjectImport(id, source))) {
    // Already written, or another request is writing them.
    const state = await getProjectImport(user.id, id);
    return Response.json({ status: state?.status ?? "none" }, { status: state?.status === "completed" ? 200 : 409 });
  }

  const { resume, job, market } = found.report;
  let repos: GithubRepo[];
  try {
    const listed = rankRepos(await listGithubRepos(target), job, resume, target.owner);
    repos = await withReadmes(target.owner, listed, README_CHARS);
  } catch (error) {
    const code = githubErrorCode(error);
    await failProjectImport(id, code).catch(() => {});
    return fail(code, 502);
  }
  if (repos.length === 0) {
    await failProjectImport(id, "no_repos").catch(() => {});
    return fail("no_repos", 422);
  }

  try {
    const { output, usage } = await writeGithubProjects({
      resume,
      job,
      market,
      repos,
      chosenByCandidate: target.repo !== null,
      uiLanguage: lang,
    });
    await recordUsage(user.id, id, usage);
    await completeProjectImport(id, finalizeProposals(output, repos, resume, target.owner));
    return Response.json({ status: "completed" });
  } catch (error) {
    console.error("[projects] failed", error);
    const code = aiErrorCode(error);
    if (error instanceof AIStepError) await recordUsage(user.id, id, error.usage).catch(() => {});
    await failProjectImport(id, code).catch(() => {});
    return fail(code, 502);
  }
}
