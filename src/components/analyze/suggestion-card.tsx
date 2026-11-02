"use client";

import type { Dictionary } from "@/i18n/types";
import type { BulletSuggestion } from "@/lib/ai/schemas/analysis";
import type { Decision } from "@/lib/analysis/types";
import { CopyButton } from "./copy-button";

interface Props {
  suggestion: BulletSuggestion;
  context: string;
  decision: Decision | undefined;
  onDecide: (decision: Decision | undefined) => void;
  dict: Dictionary["analyze"]["result"];
}

export function SuggestionCard({ suggestion, context, decision, onDecide, dict }: Props) {
  const border =
    decision === "accepted" ? "border-success" : decision === "rejected" ? "border-line opacity-60" : "border-line";

  return (
    <li className={`rounded-xl border bg-card p-5 ${border}`}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-subtle">
        <span>{context}</span>
        {suggestion.needs_user_confirmation && (
          <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning">
            {dict.needsConfirmation}
          </span>
        )}
      </div>

      <dl className="mt-3 grid gap-3 text-sm">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">{dict.original}</dt>
          <dd className="mt-1 text-subtle line-through decoration-line">{suggestion.original}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-primary">{dict.proposed}</dt>
          <dd className="mt-1 rounded-lg bg-soft px-3 py-2 font-medium leading-relaxed">{suggestion.proposed}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-subtle">{dict.reason}</dt>
          <dd className="mt-1 leading-relaxed">{suggestion.reason}</dd>
        </div>
      </dl>

      {suggestion.confirmation_question && (
        <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          {suggestion.confirmation_question}
        </p>
      )}

      {suggestion.keywords_added.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-subtle">{dict.keywordsAdded}:</span>
          {suggestion.keywords_added.map((keyword) => (
            <span key={keyword} className="rounded-full bg-success-soft px-2 py-0.5 text-success">
              {keyword}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {decision ? (
          <>
            <span className={`text-sm font-medium ${decision === "accepted" ? "text-success" : "text-subtle"}`}>
              {decision === "accepted" ? dict.accepted : dict.rejected}
            </span>
            <button
              type="button"
              onClick={() => onDecide(undefined)}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-subtle hover:bg-soft"
            >
              {dict.undo}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onDecide("accepted")}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg hover:opacity-90"
            >
              {dict.accept}
            </button>
            <button
              type="button"
              onClick={() => onDecide("rejected")}
              className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-subtle hover:bg-soft"
            >
              {dict.reject}
            </button>
          </>
        )}
        <CopyButton text={suggestion.proposed} label={dict.copy} copiedLabel={dict.copied} />
      </div>
    </li>
  );
}
