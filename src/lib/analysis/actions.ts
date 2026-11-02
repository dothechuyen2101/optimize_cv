"use server";

import { getSessionUser } from "@/lib/auth/session";
import { setDecision } from "./service";
import type { Decision } from "./types";

export async function saveSuggestionDecision(
  analysisId: string,
  index: number,
  decision: Decision | null,
): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  if (decision !== null && decision !== "accepted" && decision !== "rejected") return;
  await setDecision(user.id, analysisId, index, decision);
}
