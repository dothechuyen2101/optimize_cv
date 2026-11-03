import { aiErrorCode } from "@/lib/ai/errors";
import { AIStepError } from "@/lib/ai/run-step";
import { nextInterviewTurn } from "@/lib/ai/steps/interview";
import { recordUsage } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";
import { appendTurns, loadInterview } from "@/lib/interview/service";
import { MAX_ANSWER_CHARS, MAX_TURNS, type InterviewErrorCode } from "@/lib/interview/types";

export const maxDuration = 60;

const fail = (code: InterviewErrorCode, status: number) => Response.json({ code }, { status });

/** Records the candidate's answer and returns it with the interviewer's next turn. Body: { answer }. */
export async function POST(request: Request, ctx: RouteContext<"/api/interviews/[id]/answer">) {
  const user = await getSessionUser();
  if (!user) return fail("unauthorized", 401);
  const { id } = await ctx.params;
  const interview = await loadInterview(user.id, id);
  if (!interview) return fail("invalid_request", 404);

  const last = interview.turns.at(-1);
  if (interview.status !== "active" || !last || last.role !== "interviewer" || last.kind === "closing") {
    return fail("interview_over", 409);
  }
  if (interview.turns.length >= MAX_TURNS) return fail("interview_over", 409);

  const body = (await request.json().catch(() => null)) as { answer?: unknown } | null;
  const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
  if (!answer) return fail("answer_empty", 400);
  if (answer.length > MAX_ANSWER_CHARS) return fail("answer_too_long", 400);

  const transcript = [
    ...interview.turns.map(({ role, kind, content }) => ({ role, kind, content })),
    { role: "candidate" as const, content: answer },
  ];
  try {
    const { output, usage } = await nextInterviewTurn({ ...interview, transcript });
    await recordUsage(user.id, interview.analysisId, usage);
    const turns = await appendTurns(id, last.position, [
      { role: "candidate", content: answer, feedback: interview.settings.feedback ? output.feedback : null },
      { role: "interviewer", kind: output.kind, content: output.message },
    ]);
    return Response.json({ turns });
  } catch (error) {
    console.error("[interview] turn failed", error);
    if (error instanceof AIStepError) await recordUsage(user.id, interview.analysisId, error.usage).catch(() => {});
    return fail(aiErrorCode(error), 502);
  }
}
