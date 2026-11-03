"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { format, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { hasQuotaLeft, type QuotaStatus } from "@/lib/billing/quota";
import { MAX_PORTFOLIO_PDF_BYTES, type PortfolioErrorCode } from "@/lib/portfolio/types";

interface Props {
  analysisId: string;
  locale: Locale;
  quota: QuotaStatus;
  dict: Dictionary["portfolio"];
  errors: Dictionary["analyze"]["errors"];
}

export function PortfolioForm({ analysisId, locale, quota, dict, errors }: Props) {
  const router = useRouter();
  const [github, setGithub] = useState("");
  const [urls, setUrls] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const outOfQuota = !hasQuotaLeft(quota);
  const [error, setError] = useState<PortfolioErrorCode | null>(outOfQuota ? "quota_exceeded" : null);
  const message = (code: PortfolioErrorCode) =>
    code in dict.errors ? dict.errors[code as keyof typeof dict.errors] : errors[code as keyof typeof errors];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!github.trim() && !urls.trim() && !pdf) return setError("no_sources");
    if (pdf && pdf.size > MAX_PORTFOLIO_PDF_BYTES) return setError("file_too_large");
    setSubmitting(true);
    setError(null);
    const body = new FormData();
    body.set("analysisId", analysisId);
    body.set("lang", locale);
    body.set("github", github);
    body.set("urls", urls);
    if (pdf) body.set("pdf", pdf);
    try {
      const response = await fetch("/api/portfolio-reviews", { method: "POST", body });
      const data = (await response.json().catch(() => null)) as { id?: string; code?: PortfolioErrorCode } | null;
      if (response.ok && data?.id) {
        router.push(`/${locale}/portfolio/${data.id}`);
        return;
      }
      setError(data?.code ?? "server");
    } catch {
      setError("server");
    }
    setSubmitting(false);
  }

  const input = "rounded-lg border border-line bg-card px-3 py-2 text-sm";
  const quotaNote =
    quota.limit === null
      ? dict.unlimited
      : format(dict.quotaLeft, { remaining: Math.max(0, quota.limit - quota.used), limit: quota.limit });

  return (
    <form onSubmit={submit} className="grid gap-5 rounded-xl border border-line bg-card p-5 sm:p-6">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">{dict.github}</span>
        <input
          value={github}
          onChange={(e) => setGithub(e.target.value)}
          disabled={submitting}
          placeholder={dict.githubPlaceholder}
          className={input}
        />
        <span className="text-xs text-subtle">{dict.githubHint}</span>
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">{dict.urls}</span>
        <textarea
          value={urls}
          onChange={(e) => setUrls(e.target.value)}
          disabled={submitting}
          placeholder={dict.urlsPlaceholder}
          rows={3}
          className={`${input} resize-y`}
        />
        <span className="text-xs text-subtle">{dict.urlsHint}</span>
      </label>
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">{dict.pdf}</span>
        <input
          type="file"
          accept=".pdf,application/pdf"
          disabled={submitting}
          onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
          className="text-sm file:mr-3 file:rounded-md file:border file:border-line file:bg-soft file:px-3 file:py-1.5 file:text-sm"
        />
        <span className="text-xs text-subtle">{pdf ? format(dict.pdfSelected, { name: pdf.name }) : dict.pdfHint}</span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          {message(error)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={submitting || outOfQuota}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {dict.submit}
        </button>
        <span className="text-sm text-subtle" aria-live="polite">
          {submitting ? dict.submitting : quotaNote}
        </span>
      </div>
    </form>
  );
}
