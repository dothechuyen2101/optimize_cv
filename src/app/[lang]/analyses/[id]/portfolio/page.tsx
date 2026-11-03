import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PortfolioForm } from "@/components/portfolio/portfolio-form";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getAnalysisReport } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";
import { getPortfolioQuota, listPortfolioReviews } from "@/lib/portfolio/service";

async function Setup({ params }: { params: PageProps<"/[lang]/analyses/[id]/portfolio">["params"] }) {
  const { id } = await params;
  const locale = await getLocale();
  const { portfolio: dict, analyze } = await getDictionary();

  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/analyses/${id}/portfolio`);
  const [found, quota, previous] = await Promise.all([
    getAnalysisReport(user.id, id),
    getPortfolioQuota(user.id),
    listPortfolioReviews(user.id, id),
  ]);
  if (!found) notFound();
  const { job } = found.report;
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  });

  return (
    <>
      <Link href={`/${locale}/analyses/${id}`} className="text-sm text-subtle hover:text-foreground">
        ← {dict.back}
      </Link>
      <header className="mt-4 mb-6 grid gap-1">
        <h1 className="text-2xl font-semibold">{dict.title}</h1>
        <p className="text-sm font-medium">
          {job.title}
          {job.company && <span className="font-normal text-subtle"> · {job.company}</span>}
        </p>
        <p className="text-sm text-subtle">{dict.subtitle}</p>
      </header>
      <PortfolioForm analysisId={id} locale={locale} quota={quota} dict={dict} errors={analyze.errors} />

      {previous.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{dict.previous}</h2>
          <ul className="mt-3 grid gap-3">
            {previous.map((review) => (
              <li key={review.id}>
                <Link
                  href={`/${locale}/portfolio/${review.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-line bg-card px-5 py-4 hover:border-primary"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {[review.sources.github, ...review.sources.urls, review.sources.pdf].filter(Boolean).join(" · ")}
                    </p>
                    <p className="mt-1 text-xs text-subtle">{date.format(review.createdAt)}</p>
                  </div>
                  {review.overall !== null && (
                    <span className="shrink-0 rounded-full bg-soft px-2.5 py-1 text-sm font-semibold tabular-nums text-primary">
                      {review.overall}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

export default function PortfolioSetupPage({ params }: PageProps<"/[lang]/analyses/[id]/portfolio">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Suspense fallback={<div className="h-96 rounded-xl border border-line bg-card" />}>
        <Setup params={params} />
      </Suspense>
    </div>
  );
}
