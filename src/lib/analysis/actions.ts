"use server";

import { getSessionUser } from "@/lib/auth/session";
import { getSavedJob, setChoice } from "./service";
import type { Choice, SavedJob, SuggestionTarget } from "./types";

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

/** The JD of one of the user's analyses, to fill the analyze form with. */
export async function loadSavedJob(analysisId: string): Promise<SavedJob | null> {
  const user = await getSessionUser();
  if (!user || typeof analysisId !== "string") return null;
  return getSavedJob(user.id, analysisId);
}
