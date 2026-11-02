import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale } from "@/i18n/config";
import { safeNextPath } from "@/lib/auth/next-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Landing point for links in sign-up confirmation and password-reset emails. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"), `/${defaultLocale}/analyze`);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  const segment = next.split("/")[1] ?? "";
  const locale = hasLocale(segment) ? segment : defaultLocale;
  return NextResponse.redirect(new URL(`/${locale}/login?error=link_invalid`, origin));
}
