"use server";

import { redirect } from "next/navigation";
import { hasLocale } from "@/i18n/config";
import { getSessionUser } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { deleteAccount } from "./service";

export interface DeleteAccountState {
  error?: "confirm_mismatch";
}

/** Deletes the signed-in user's account once they type their email to confirm. */
export async function deleteAccountAction(_state: DeleteAccountState, formData: FormData): Promise<DeleteAccountState> {
  const locale = String(formData.get("locale") ?? "");
  const lang = hasLocale(locale) ? locale : "vi";
  const user = await getSessionUser();
  if (!user) redirect(`/${lang}/login`);

  const typed = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (!user.email || typed !== user.email.toLowerCase()) return { error: "confirm_mismatch" };

  await deleteAccount(user.id);
  // The tokens are dead with the user; this clears them from the browser.
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope: "local" }).catch(() => {});
  redirect(`/${lang}/goodbye`);
}
