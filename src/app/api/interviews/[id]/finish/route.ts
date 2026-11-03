import { aiErrorCode } from "@/lib/ai/errors";
import { AIStepError } from "@/lib/ai/run-step";
import { scoreInterview } from "@/lib/ai/steps/interview";
import { recordUsage } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/billing/rate-limit";
import { completeInterview, loadInterview } from "@/lib/interview/service";
import type { InterviewErrorCode } from "@/lib/interview/types";

export const maxDuration = 120;

const fail = (code: InterviewErrorCode, status: number) => Response.json({ code }, { status });

/** Ends the session and scores it; a scored session returns its stored report. */
export async function POST(_request: Request, ctx: RouteContext<"/api/interviews/[id]/finish">) {
  const user = await getSessionUser();
  if (!user) return fail("unauthorized", 401);
  const { id } = await ctx.params;
  const interview = await loadInterview(user.id, id);
  if (!interview) return fail("invalid_request", 404);
  if (interview.report) return Response.json({ report: interview.report });
  // Scoring an empty transcript would spend the strong model on nothing.
  if (!interview.turns.some((turn) => turn.role === "candidate")) return fail("no_answers", 409);
  if (await isRateLimited(user.id)) return fail("too_many_requests", 429);

  try {
    const transcript = interview.turns.map(({ role, kind, content }) => ({ role, kind, content }));
    const { output, usage } = await scoreInterview({ ...interview, transcript });
    await recordUsage(user.id, interview.analysisId, usage);
    await completeInterview(id, output);
    return Response.json({ report: output });
  } catch (error) {
    console.error("[interview] scoring failed", error);
    if (error instanceof AIStepError) await recordUsage(user.id, interview.analysisId, error.usage).catch(() => {});
    return fail(aiErrorCode(error), 502);
  }
}
