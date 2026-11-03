import { getSessionUser } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/billing/rate-limit";
import { loadInterview } from "@/lib/interview/service";
import type { InterviewErrorCode } from "@/lib/interview/types";
import { grantListenToken, listenUrl, recordListenSession, speechInputConfigured } from "@/lib/speech/deepgram";

const fail = (code: InterviewErrorCode, status: number) => Response.json({ code }, { status });

/** A temporary token and URL for the browser to transcribe one spoken answer in this interview. */
export async function POST(_request: Request, ctx: RouteContext<"/api/interviews/[id]/speech-token">) {
  const user = await getSessionUser();
  if (!user) return fail("unauthorized", 401);
  const { id } = await ctx.params;
  const interview = await loadInterview(user.id, id);
  if (!interview) return fail("invalid_request", 404);
  if (interview.status !== "active" || interview.turns.at(-1)?.kind === "closing") return fail("interview_over", 409);
  if (!speechInputConfigured()) return fail("voice_unavailable", 503);
  if (await isRateLimited(user.id)) return fail("too_many_requests", 429);

  try {
    const token = await grantListenToken();
    await recordListenSession(user.id, interview.analysisId);
    return Response.json({ token, url: listenUrl(interview.settings.language) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[speech] token failed", error);
    return fail("server", 502);
  }
}
