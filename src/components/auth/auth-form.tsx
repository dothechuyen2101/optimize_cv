"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { format, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/lib/auth/actions";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/types";

const ACTIONS = { login: signIn, signup: signUp, forgot: requestPasswordReset, reset: updatePassword };

export type AuthMode = keyof typeof ACTIONS;

const INPUT = "rounded-lg border border-line bg-card px-3 py-2.5 text-sm";

export function AuthForm({ mode, locale, dict }: { mode: AuthMode; locale: Locale; dict: Dictionary["auth"] }) {
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState(ACTIONS[mode], null);

  const errorCode = state && "error" in state ? state.error : searchParams.get("error") === "link_invalid" ? "link_invalid" : null;
  const notice = state && "notice" in state ? format(dict.notices[state.notice], { email: state.email }) : null;
  const newPassword = mode === "signup" || mode === "reset";

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="locale" value={locale} />
      {mode === "login" && <input type="hidden" name="next" value={searchParams.get("next") ?? ""} />}

      {mode !== "reset" && (
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{dict.email}</span>
          <input name="email" type="email" required autoComplete="email" className={INPUT} />
        </label>
      )}

      {mode !== "forgot" && (
        <label className="grid gap-1.5">
          <span className="flex items-center justify-between text-sm font-medium">
            {mode === "reset" ? dict.newPassword : dict.password}
            {mode === "login" && (
              <Link href={`/${locale}/forgot-password`} className="font-normal text-primary hover:underline">
                {dict.forgotLink}
              </Link>
            )}
          </span>
          <input
            name="password"
            type="password"
            required
            minLength={newPassword ? MIN_PASSWORD_LENGTH : undefined}
            autoComplete={newPassword ? "new-password" : "current-password"}
            className={INPUT}
          />
          {newPassword && (
            <span className="text-xs text-subtle">{format(dict.passwordHint, { min: MIN_PASSWORD_LENGTH })}</span>
          )}
        </label>
      )}

      {errorCode && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {dict.errors[errorCode]}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
          {notice}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-60"
      >
        {pending ? dict.pending : dict[mode].submit}
      </button>

      {(mode === "login" || mode === "signup") && (
        <p className="text-center text-sm text-subtle">
          {mode === "login" ? dict.noAccount : dict.haveAccount}{" "}
          <Link href={`/${locale}/${mode === "login" ? "signup" : "login"}`} className="font-medium text-primary hover:underline">
            {mode === "login" ? dict.signupLink : dict.loginLink}
          </Link>
        </p>
      )}
    </form>
  );
}
