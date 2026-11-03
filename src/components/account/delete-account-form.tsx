"use client";

import { useActionState, useState } from "react";
import { format, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { deleteAccountAction } from "@/lib/account/actions";

interface Props {
  locale: Locale;
  email: string;
  dict: Dictionary["account"];
}

/** Deletion needs the account's email typed in; the server checks it again. */
export function DeleteAccountForm({ locale, email, dict }: Props) {
  const [state, action, pending] = useActionState(deleteAccountAction, {});
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="locale" value={locale} />
      <label className="grid gap-1.5">
        <span className="text-sm">{format(dict.deleteConfirm, { email })}</span>
        <input
          name="confirm"
          type="email"
          autoComplete="off"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          className="rounded-lg border border-line bg-card px-3 py-2 text-sm"
        />
      </label>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {dict.deleteMismatch}
        </p>
      )}
      <button
        type="submit"
        disabled={!matches || pending}
        className="justify-self-start rounded-lg bg-danger px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
      >
        {dict.deleteButton}
      </button>
    </form>
  );
}
