"use server";

import type { Decision } from "@/lib/analysis/types";
import { getSessionUser } from "@/lib/auth/session";
import { setProjectDecisions } from "./service";

/** Saves the user's accept/skip calls on GitHub project proposals; null undoes a call. */
export async function saveProjectDecisions(analysisId: string, changes: Record<number, Decision | null>): Promise<void> {
  const user = await getSessionUser();
  if (!user || typeof analysisId !== "string" || typeof changes !== "object" || changes === null) return;
  await setProjectDecisions(user.id, analysisId, changes);
}
