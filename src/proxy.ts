import { match } from "@formatjs/intl-localematcher";
import Negotiator from "negotiator";
import { NextResponse, type NextRequest } from "next/server";
import { defaultLocale, hasLocale, LOCALE_COOKIE, locales, type Locale } from "@/i18n/config";
import { updateSession } from "@/lib/supabase/proxy";

// First path segment after the locale.
const SIGNED_IN_ONLY = new Set(["analyze", "history", "analyses", "interviews", "reset-password"]);
const SIGNED_OUT_ONLY = new Set(["login", "signup"]);

function preferredLocale(request: NextRequest): Locale {
  const saved = request.cookies.get(LOCALE_COOKIE)?.value;
  if (saved && hasLocale(saved)) return saved;

  const languages = new Negotiator({
    headers: { "accept-language": request.headers.get("accept-language") ?? "" },
  }).languages();
  try {
    return match(languages, locales, defaultLocale) as Locale;
  } catch {
    // Malformed Accept-Language values make the matcher throw.
    return defaultLocale;
  }
}

/** Redirects while keeping any cookies the session refresh wrote. */
function redirectWith(response: NextResponse, url: URL): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  return redirect;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const [, locale = "", section = ""] = pathname.split("/");

  if (!hasLocale(locale)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${preferredLocale(request)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  const { response, signedIn } = await updateSession(request);
  if (request.cookies.get(LOCALE_COOKIE)?.value !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  }

  if (!signedIn && SIGNED_IN_ONLY.has(section)) {
    const url = new URL(`/${locale}/login`, request.url);
    url.searchParams.set("next", pathname + search);
    return redirectWith(response, url);
  }
  if (signedIn && SIGNED_OUT_ONLY.has(section)) {
    return redirectWith(response, new URL(`/${locale}/analyze`, request.url));
  }
  return response;
}

export const config = {
  // Skip API routes, Next internals and files with an extension (favicon, images…).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
