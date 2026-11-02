"use server";

import { getSessionUser } from "@/lib/auth/session";
import type { CvEdit } from "./document";
import { setCvEdit } from "./service";

/** Returns whether the edit was stored, so the editor can tell the user when it wasn't. */
export async function saveCvEdit(analysisId: string, key: string, edit: CvEdit | null): Promise<boolean> {
  const user = await getSessionUser();
  if (!user || typeof analysisId !== "string" || typeof key !== "string") return false;
  if (edit !== null && (typeof edit?.base !== "string" || typeof edit.value !== "string")) return false;
  return setCvEdit(user.id, analysisId, key, edit);
}
