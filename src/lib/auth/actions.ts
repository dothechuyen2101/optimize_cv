"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { defaultLocale, hasLocale, type Locale } from "@/i18n/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextPath } from "./next-path";
import { getSessionUser } from "./session";
import { MIN_PASSWORD_LENGTH, type AuthErrorCode, type AuthFormState } from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function formLocale(formData: FormData): Locale {
  const value = field(formData, "locale");
  return hasLocale(value) ? value : defaultLocale;
}

function errorCode(error: AuthError): AuthErrorCode {
  switch (error.code) {
    case "invalid_credentials":
      return "invalid_credentials";
    case "email_not_confirmed":
      return "email_not_confirmed";
    case "weak_password":
      return "weak_password";
    case "same_password":
      return "same_password";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "rate_limited";
    case "email_address_not_authorized":
      return "email_send_failed";
    default:
      return "unknown";
  }
}

/** Where links in auth emails point back to; Supabase must allow it under Redirect URLs. */
async function callbackUrl(next: string): Promise<string> {
  const requestHeaders = await headers();
  const origin =
    process.env.SITE_URL ??
    requestHeaders.get("origin") ??
    `${requestHeaders.get("x-forwarded-proto") ?? "http"}://${requestHeaders.get("host")}`;
  return `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`;
}

export async function signIn(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = formLocale(formData);
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  if (!EMAIL_PATTERN.test(email) || !password) return { error: "invalid_input" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: errorCode(error) };
  redirect(safeNextPath(field(formData, "next"), `/${locale}/analyze`));
}

export async function signUp(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = formLocale(formData);
  const email = field(formData, "email").trim();
  const password = field(formData, "password");
  if (!EMAIL_PATTERN.test(email)) return { error: "invalid_input" };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: "weak_password" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: await callbackUrl(`/${locale}/analyze`) },
  });
  if (error) return { error: errorCode(error) };
  // With email confirmation off, the user is signed in right away.
  if (data.session) redirect(`/${locale}/analyze`);
  // Same answer whether or not the email already had an account, so it can't be probed.
  return { notice: "check_email", email };
}

export async function requestPasswordReset(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = formLocale(formData);
  const email = field(formData, "email").trim();
  if (!EMAIL_PATTERN.test(email)) return { error: "invalid_input" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: await callbackUrl(`/${locale}/reset-password`),
  });
  if (error && errorCode(error) === "rate_limited") return { error: "rate_limited" };
  return { notice: "reset_sent", email };
}

export async function updatePassword(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const locale = formLocale(formData);
  if (!(await getSessionUser())) redirect(`/${locale}/login`);
  const password = field(formData, "password");
  if (password.length < MIN_PASSWORD_LENGTH) return { error: "weak_password" };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: errorCode(error) };
  redirect(`/${locale}/analyze`);
}

export async function signOut(formData: FormData): Promise<void> {
  const supabase = await createSupabaseServerClient();
  // "local" ends this browser's session only, not the user's other devices.
  await supabase.auth.signOut({ scope: "local" });
  redirect(`/${formLocale(formData)}`);
}
