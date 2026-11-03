import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { PortfolioReviewView } from "@/components/portfolio/portfolio-review-view";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { getPortfolioReview } from "@/lib/portfolio/service";

async function Review({ params }: { params: PageProps<"/[lang]/portfolio/[id]">["params"] }) {
  const { id } = await params;
  const locale = await getLocale();
  const { portfolio: dict } = await getDictionary();

  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/portfolio/${id}`);
  const review = await getPortfolioReview(user.id, id);
  if (!review) notFound();
  const setupHref = `/${locale}/analyses/${review.analysisId}/portfolio`;

  return (
    <>
      <Link href={setupHref} className="text-sm text-subtle hover:text-foreground">
        ← {dict.title}
      </Link>
      <header className="mt-4 mb-6 grid gap-1">
        <h1 className="text-2xl font-semibold">{dict.resultTitle}</h1>
        <p className="text-sm font-medium">
          {review.jobTitle}
          {review.company && <span className="font-normal text-subtle"> · {review.company}</span>}
        </p>
        <p className="break-all text-xs text-subtle">
          {dict.reviewed}: {[review.sources.github, ...review.sources.urls, review.sources.pdf].filter(Boolean).join(" · ")}
        </p>
      </header>
      <PortfolioReviewView review={review.result} dict={dict} />
      <Link
        href={setupHref}
        className="mt-6 inline-block rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium hover:bg-soft"
      >
        {dict.again}
      </Link>
    </>
  );
}

export default function PortfolioReviewPage({ params }: PageProps<"/[lang]/portfolio/[id]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Suspense fallback={<div className="h-96 rounded-xl border border-line bg-card" />}>
        <Review params={params} />
      </Suspense>
    </div>
  );
}
