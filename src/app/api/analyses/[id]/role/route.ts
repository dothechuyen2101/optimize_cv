import { hasLocale } from "@/i18n/config";
import { aiErrorCode } from "@/lib/ai/errors";
import { AIStepError } from "@/lib/ai/run-step";
import { analyzeRole } from "@/lib/ai/steps/role-analysis";
import { getAnalysisReport, recordUsage } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";
import { claimRoleReport, completeRoleReport, failRoleReport, getRoleReport } from "@/lib/role/service";

export const maxDuration = 120;

/** Generates the role analysis of the user's CV analysis, once. Body: { lang } for the report's language. */
export async function POST(request: Request, ctx: RouteContext<"/api/analyses/[id]/role">) {
  const user = await getSessionUser();
  if (!user) return Response.json({ code: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const found = await getAnalysisReport(user.id, id);
  if (!found) return Response.json({ code: "invalid_request" }, { status: 404 });

  if (!(await claimRoleReport(id))) {
    // Already generated, or another request is generating it.
    const state = await getRoleReport(user.id, id);
    return Response.json({ status: state?.status ?? "none" }, { status: state?.status === "completed" ? 200 : 409 });
  }

  const body = (await request.json().catch(() => null)) as { lang?: unknown } | null;
  const lang = typeof body?.lang === "string" && hasLocale(body.lang) ? body.lang : "vi";
  const { resume, job, ats, market } = found.report;
  try {
    const { output, usage } = await analyzeRole({ resume, job, ats, market, uiLanguage: lang });
    await recordUsage(user.id, id, usage);
    await completeRoleReport(id, output);
    return Response.json({ status: "completed" });
  } catch (error) {
    console.error("[role] failed", error);
    const code = aiErrorCode(error);
    if (error instanceof AIStepError) await recordUsage(user.id, id, error.usage).catch(() => {});
    await failRoleReport(id, code).catch(() => {});
    return Response.json({ code }, { status: 502 });
  }
}
