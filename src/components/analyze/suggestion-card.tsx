"use client";

import { useState } from "react";
import { format } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { MAX_SUGGESTION_TEXT, findPlaceholders, type Choice } from "@/lib/analysis/types";
import { CopyButton } from "./copy-button";
import { WithPlaceholders } from "./with-placeholders";

/** The fields a line suggestion and the summary rewrite share. */
export interface SuggestionView {
  original: string | null;
  proposed: string;
  reason: string;
  keywords_added?: string[];
  needs_user_confirmation?: boolean;
  confirmation_question?: string | null;
}

interface Props {
  suggestion: SuggestionView;
  context?: string;
  choice: Choice | null;
  onChoose: (choice: Choice | null) => void;
  dict: Dictionary["analyze"]["result"];
}

export function SuggestionCard({ suggestion, context, choice, onChoose, dict }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const decision = choice?.decision;
  const text = choice?.text ?? suggestion.proposed;
  const gaps = decision === "accepted" && draft === null ? findPlaceholders(text) : [];
  const border =
    decision === "accepted" ? "border-success" : decision === "rejected" ? "border-line opacity-60" : "border-line";

  function accept() {
    onChoose({ decision: "accepted", text: choice?.text ?? null });
    // Gaps like "[X%]" would end up in the exported CV, so open the editor right away.
    if (findPlaceholders(text).length > 0) setDraft(text);
  }

  function save() {
    const value = draft?.trim();
    if (!value) return;
    onChoose({ decision: "accepted", text: value === suggestion.proposed ? null : value });
    setDraft(null);
  }

  const button = "rounded-md px-3 py-1.5 text-xs font-medium";
  return (
    <div className={`rounded-xl border bg-card p-5 ${border}`}>
      {(context || suggestion.needs_user_confirmation) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-subtle">
          {context && <span>{context}</span>}
          {suggestion.needs_user_confirmation && (
            <span className="rounded-full bg-warning-soft px-2 py-0.5 font-medium text-warning">
              {dict.needsConfirmation}
            </span>
          )}
        </div>
      )}

      <dl className="grid gap-3 text-sm">
        {suggestion.original && (
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-subtle">{dict.original}</dt>
            <dd className="mt-1 text-subtle line-through decoration-line">{suggestion.original}</dd>
          </div>
        )}
        <div>
          <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
            {dict.proposed}
            {choice?.text && <span className="normal-case tracking-normal text-subtle">({dict.edited})</span>}
          </dt>
          <dd className="mt-1">
            {draft === null ? (
              <p className="rounded-lg bg-soft px-3 py-2 font-medium leading-relaxed">
                <WithPlaceholders text={text} />
              </p>
            ) : (
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                aria-label={dict.proposed}
                maxLength={MAX_SUGGESTION_TEXT}
                rows={Math.max(3, Math.ceil(draft.length / 90))}
                autoFocus
                className="w-full resize-y rounded-lg border border-primary bg-card px-3 py-2 font-medium leading-relaxed"
              />
            )}
          </dd>
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

      {gaps.length > 0 && (
        <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm font-medium text-warning">
          {format(dict.fillPlaceholders, { placeholders: gaps.join(", ") })}
        </p>
      )}

      {suggestion.keywords_added && suggestion.keywords_added.length > 0 && (
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
        {draft !== null ? (
          <>
            <button
              type="button"
              onClick={save}
              disabled={!draft.trim()}
              className={`${button} bg-primary font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50`}
            >
              {dict.save}
            </button>
            <button type="button" onClick={() => setDraft(null)} className={`${button} text-subtle hover:bg-soft`}>
              {dict.cancel}
            </button>
          </>
        ) : decision ? (
          <>
            <span className={`text-sm font-medium ${decision === "accepted" ? "text-success" : "text-subtle"}`}>
              {decision === "accepted" ? dict.accepted : dict.rejected}
            </span>
            {decision === "accepted" && (
              <button
                type="button"
                onClick={() => setDraft(text)}
                className={`${button} border border-line hover:bg-soft`}
              >
                {dict.edit}
              </button>
            )}
            <button type="button" onClick={() => onChoose(null)} className={`${button} text-subtle hover:bg-soft`}>
              {dict.undo}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={accept}
              className={`${button} bg-primary font-semibold text-primary-fg hover:opacity-90`}
            >
              {dict.accept}
            </button>
            <button
              type="button"
              onClick={() => onChoose({ decision: "rejected", text: null })}
              className={`${button} border border-line text-subtle hover:bg-soft`}
            >
              {dict.reject}
            </button>
          </>
        )}
        {draft === null && <CopyButton text={text} label={dict.copy} copiedLabel={dict.copied} />}
      </div>
    </div>
  );
}
