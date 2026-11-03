"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { format, locales, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import type { InterviewDifficulty, InterviewType } from "@/lib/ai/schemas/interview";
import { hasQuotaLeft, type QuotaStatus } from "@/lib/billing/quota";
import type { InterviewErrorCode } from "@/lib/interview/types";
import { interviewErrorText } from "./error-text";

const TYPES: InterviewType[] = ["behavioral", "technical", "hr", "mixed"];
const DIFFICULTIES: InterviewDifficulty[] = ["easy", "normal", "hard"];

interface Props {
  analysisId: string;
  locale: Locale;
  quota: QuotaStatus;
  /** The language of the JD, which the interview defaults to. */
  defaultLanguage: Locale;
  dict: Dictionary["interview"];
  errors: Dictionary["analyze"]["errors"];
}

export function InterviewSetup({ analysisId, locale, quota, defaultLanguage, dict, errors }: Props) {
  const router = useRouter();
  const [type, setType] = useState<InterviewType>("mixed");
  const [difficulty, setDifficulty] = useState<InterviewDifficulty>("normal");
  const [language, setLanguage] = useState<Locale>(defaultLanguage);
  const [feedback, setFeedback] = useState(true);
  const [starting, setStarting] = useState(false);
  const outOfQuota = !hasQuotaLeft(quota);
  const [error, setError] = useState<InterviewErrorCode | null>(outOfQuota ? "quota_exceeded" : null);

  async function start(event: FormEvent) {
    event.preventDefault();
    setStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/interviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysisId, type, difficulty, language, feedback }),
      });
      const body = (await response.json().catch(() => null)) as { id?: string; code?: InterviewErrorCode } | null;
      if (response.ok && body?.id) {
        router.push(`/${locale}/interviews/${body.id}`);
        return;
      }
      setError(body?.code ?? "server");
    } catch {
      setError("server");
    }
    setStarting(false);
  }

  const select = "rounded-lg border border-line bg-card px-3 py-2 text-sm";
  const quotaNote =
    quota.limit === null
      ? dict.unlimited
      : format(dict.quotaLeft, { remaining: Math.max(0, quota.limit - quota.used), limit: quota.limit });

  return (
    <form onSubmit={start} className="grid gap-5 rounded-xl border border-line bg-card p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{dict.type}</span>
          <select value={type} disabled={starting} onChange={(e) => setType(e.target.value as InterviewType)} className={select}>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {dict.types[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{dict.difficulty}</span>
          <select
            value={difficulty}
            disabled={starting}
            onChange={(e) => setDifficulty(e.target.value as InterviewDifficulty)}
            className={select}
          >
            {DIFFICULTIES.map((value) => (
              <option key={value} value={value}>
                {dict.difficulties[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">{dict.language}</span>
          <select value={language} disabled={starting} onChange={(e) => setLanguage(e.target.value as Locale)} className={select}>
            {locales.map((value) => (
              <option key={value} value={value}>
                {dict.languages[value]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={feedback}
          disabled={starting}
          onChange={(e) => setFeedback(e.target.checked)}
          className="mt-1 size-4 accent-[var(--primary)]"
        />
        <span className="grid gap-0.5">
          <span className="text-sm font-medium">{dict.feedback}</span>
          <span className="text-xs text-subtle">{dict.feedbackHint}</span>
        </span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          {interviewErrorText(error, dict, errors)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={starting || outOfQuota}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {dict.start}
        </button>
        <span className="text-sm text-subtle" aria-live="polite">
          {starting ? dict.starting : quotaNote}
        </span>
      </div>
    </form>
  );
}
