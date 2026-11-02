import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * The signed-in user from a verified session token, or null. This is the
 * authorization check: the proxy's redirect is only an optimistic shortcut.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;
  const { sub, email } = data.claims;
  return { id: sub, email: typeof email === "string" ? email : null };
});
