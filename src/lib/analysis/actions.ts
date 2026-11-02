"use server";

import { getSessionUser } from "@/lib/auth/session";
import { setChoice } from "./service";
import type { Choice, SuggestionTarget } from "./types";

function isTarget(value: SuggestionTarget): boolean {
  return value?.kind === "summary" || (value?.kind === "bullet" && Number.isInteger(value.index));
}

function isChoice(value: Choice | null): boolean {
  if (value === null) return true;
  return (
    (value?.decision === "accepted" || value?.decision === "rejected") &&
    (value.text === null || typeof value.text === "string")
  );
}

export async function saveSuggestionChoice(
  analysisId: string,
  target: SuggestionTarget,
  choice: Choice | null,
): Promise<void> {
  const user = await getSessionUser();
  if (!user || !isTarget(target) || !isChoice(choice)) return;
  await setChoice(user.id, analysisId, target, choice);
}
