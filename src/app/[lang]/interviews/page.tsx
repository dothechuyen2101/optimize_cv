import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { scoreTone } from "@/components/analyze/score-ring";
import { format, type Locale } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import type { Dictionary } from "@/i18n/types";
import { getSessionUser } from "@/lib/auth/session";
import { getQuota } from "@/lib/billing/limits";
import { listInterviews } from "@/lib/interview/service";

const SCORE_STYLE = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

async function InterviewList({ locale, dict }: { locale: Locale; dict: Dictionary["interview"] }) {
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/interviews`);
  const [items, quota] = await Promise.all([listInterviews(user.id), getQuota(user.id)]);
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  });

  return (
    <>
      {quota.limit !== null && (
        <p className="mt-2 text-sm text-subtle">{format(dict.quota, { used: quota.used, limit: quota.limit })}</p>
      )}
      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line p-10 text-center">
          <p className="text-subtle">{dict.listEmpty}</p>
          <Link
            href={`/${locale}/history`}
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90"
          >
            {dict.listStart}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              <Link
                href={`/${locale}/interviews/${item.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-line bg-card px-5 py-4 hover:border-primary"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {item.jobTitle}
                    {item.company && <span className="font-normal text-subtle"> · {item.company}</span>}
                  </p>
                  <p className="mt-1 truncate text-xs text-subtle">
                    {date.format(item.createdAt)} · {dict.types[item.type]} · {dict.difficulties[item.difficulty]}
                  </p>
                </div>
                {item.overall !== null ? (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${SCORE_STYLE[scoreTone(item.overall)]}`}
                  >
                    {item.overall}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-soft px-2.5 py-1 text-xs font-medium text-subtle">
                    {dict.active}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export default async function InterviewsPage() {
  const locale = await getLocale();
  const { interview } = await getDictionary();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{interview.listTitle}</h1>
      <p className="mt-2 text-subtle">{interview.listSubtitle}</p>
      <Suspense fallback={<div className="mt-8 h-48 rounded-xl border border-line bg-card" />}>
        <InterviewList locale={locale} dict={interview} />
      </Suspense>
    </div>
  );
}
