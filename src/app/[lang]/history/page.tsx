import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { scoreTone } from "@/components/analyze/score-ring";
import { format, type Locale } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import type { Dictionary } from "@/i18n/types";
import { getQuota, listAnalyses, type AnalysisListItem } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";

const SCORE_STYLE = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
};

function ScoreChange({ before, after, dict }: { before: number; after: number; dict: Dictionary["history"] }) {
  const delta = after - before;
  return (
    <span className="flex shrink-0 items-center gap-2" title={format(dict.improvement, { before, after })}>
      <span className="text-sm tabular-nums text-subtle">{before} →</span>
      <span className={`rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${SCORE_STYLE[scoreTone(after)]}`}>
        {after}
      </span>
      <span
        className={`w-9 text-right text-sm font-semibold tabular-nums ${delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-subtle"}`}
      >
        {delta > 0 ? `+${delta}` : delta === 0 ? "±0" : delta}
      </span>
    </span>
  );
}

function Item({ item, locale, dict }: { item: AnalysisListItem; locale: Locale; dict: Dictionary["history"] }) {
  // Most users are in Vietnam; show their wall-clock time on both locales.
  const when = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(item.createdAt);
  const done = item.status === "completed";

  const body = (
    <>
      <div className="min-w-0">
        <p className="truncate font-medium">
          {item.revised && (
            <span className="mr-2 rounded-full bg-soft px-2 py-0.5 text-xs font-medium text-primary">{dict.revised}</span>
          )}
          {item.jobTitle ?? dict.untitledJob}
          {item.company && <span className="font-normal text-subtle"> · {item.company}</span>}
        </p>
        <p className="mt-1 truncate text-xs text-subtle">
          {when}
          {item.resumeTitle && ` · ${item.resumeTitle}`}
        </p>
      </div>
      {done && item.overall !== null && item.previousOverall !== null ? (
        <ScoreChange before={item.previousOverall} after={item.overall} dict={dict} />
      ) : done && item.overall !== null ? (
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums ${SCORE_STYLE[scoreTone(item.overall)]}`}
          title={dict.score}
        >
          {item.overall}
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-soft px-2.5 py-1 text-xs font-medium text-subtle">
          {dict.status[item.status]}
        </span>
      )}
    </>
  );

  const row = "flex items-center justify-between gap-4 rounded-xl border border-line bg-card px-5 py-4";
  return (
    <li className="min-w-0">
      {done ? (
        <Link href={`/${locale}/analyses/${item.id}`} className={`${row} hover:border-primary`}>
          {body}
        </Link>
      ) : (
        <div className={row}>{body}</div>
      )}
    </li>
  );
}

async function HistoryList({ locale, dict }: { locale: Locale; dict: Dictionary["history"] }) {
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/history`);
  const [items, quota] = await Promise.all([listAnalyses(user.id), getQuota(user.id)]);

  return (
    <>
      {quota.limit !== null && (
        <p className="mt-2 text-sm text-subtle">{format(dict.quota, { used: quota.used, limit: quota.limit })}</p>
      )}
      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-line p-10 text-center">
          <p className="text-subtle">{dict.empty}</p>
          <Link
            href={`/${locale}/analyze`}
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90"
          >
            {dict.start}
          </Link>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {items.map((item) => (
            <Item key={item.id} item={item} locale={locale} dict={dict} />
          ))}
        </ul>
      )}
    </>
  );
}

export default async function HistoryPage() {
  const locale = await getLocale();
  const { history } = await getDictionary();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{history.title}</h1>
          <p className="mt-2 text-subtle">{history.subtitle}</p>
        </div>
        <Link
          href={`/${locale}/analyze`}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-fg hover:opacity-90"
        >
          {history.newAnalysis}
        </Link>
      </div>
      <Suspense fallback={<div className="mt-8 h-48 rounded-xl border border-line bg-card" />}>
        <HistoryList locale={locale} dict={history} />
      </Suspense>
    </div>
  );
}
