import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "./config";

/**
 * Refreshes an expiring session and writes the new cookies both to the request
 * (so this render sees them) and to the response. Returns that response and
 * whether the visitor has a valid session.
 */
export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; signedIn: boolean }> {
  const { url, publishableKey } = supabaseConfig();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  return { response, signedIn: Boolean(data?.claims.sub) };
}
