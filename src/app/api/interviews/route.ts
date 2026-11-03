import * as z from "zod";
import { locales } from "@/i18n/config";
import { aiErrorCode } from "@/lib/ai/errors";
import { AIStepError } from "@/lib/ai/run-step";
import { InterviewDifficultySchema, InterviewTypeSchema } from "@/lib/ai/schemas/interview";
import { nextInterviewTurn } from "@/lib/ai/steps/interview";
import { recordUsage } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/billing/rate-limit";
import { appendTurns, createInterviewSession, discardInterviewSession, loadInterview } from "@/lib/interview/service";

export const maxDuration = 60;

const CreateSchema = z.object({
  analysisId: z.string(),
  type: InterviewTypeSchema,
  difficulty: InterviewDifficultySchema,
  language: z.enum(locales),
  feedback: z.boolean(),
});

/** Starts a practice interview on the user's CV analysis and asks the first question. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ code: "unauthorized" }, { status: 401 });
  const parsed = CreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ code: "invalid_request" }, { status: 400 });
  const { analysisId, ...settings } = parsed.data;

  if (await isRateLimited(user.id)) return Response.json({ code: "too_many_requests" }, { status: 429 });
  const created = await createInterviewSession(user.id, analysisId, settings);
  if (!created) return Response.json({ code: "invalid_request" }, { status: 404 });
  if ("quota" in created) return Response.json({ code: "quota_exceeded" }, { status: 429 });

  try {
    const interview = (await loadInterview(user.id, created.id))!;
    const { output, usage } = await nextInterviewTurn({ ...interview, transcript: [] });
    await recordUsage(user.id, analysisId, usage);
    await appendTurns(created.id, -1, [{ role: "interviewer", kind: output.kind, content: output.message }]);
    return Response.json({ id: created.id });
  } catch (error) {
    console.error("[interview] start failed", error);
    if (error instanceof AIStepError) await recordUsage(user.id, analysisId, error.usage).catch(() => {});
    // No question, no session: a failed start shouldn't use quota.
    await discardInterviewSession(user.id, created.id).catch(() => {});
    return Response.json({ code: aiErrorCode(error) }, { status: 502 });
  }
}
