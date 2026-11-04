import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SavedAnalysis } from "@/components/analyze/saved-analysis";
import { format } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getAnalysisReport } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";
import { getProjectImport } from "@/lib/projects/service";

async function AnalysisDetail({ params }: { params: PageProps<"/[lang]/analyses/[id]">["params"] }) {
  const { id } = await params;
  const locale = await getLocale();
  const { analyze, history, nextSteps, projects } = await getDictionary();

  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/analyses/${id}`);
  // Scoped to the user, so another user's analysis id is simply not found.
  const [found, github] = await Promise.all([getAnalysisReport(user.id, id), getProjectImport(user.id, id)]);
  if (!found) notFound();
  const projectsHref = `/${locale}/analyses/${id}/projects`;
  const waiting =
    github?.status === "completed" ? github.result.proposals.filter((_, index) => !github.decisions[index]).length : 0;

  return (
    <>
      <Link href={`/${locale}/history`} className="text-sm text-subtle hover:text-foreground">
        ← {history.back}
      </Link>
      {(waiting > 0 || github?.status === "failed") && (
        <p className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary bg-soft px-4 py-3 text-sm">
          <span>{waiting > 0 ? format(projects.bannerPending, { count: waiting }) : projects.bannerFailed}</span>
          <Link href={projectsHref} className="font-semibold text-primary hover:underline">
            {waiting > 0 ? projects.bannerCta : projects.bannerRetry} →
          </Link>
        </p>
      )}
      <nav aria-label={nextSteps.title} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: projectsHref, title: nextSteps.projects, body: nextSteps.projectsBody },
          { href: `/${locale}/analyses/${id}/role`, title: nextSteps.role, body: nextSteps.roleBody },
          { href: `/${locale}/analyses/${id}/interview`, title: nextSteps.interview, body: nextSteps.interviewBody },
          { href: `/${locale}/analyses/${id}/portfolio`, title: nextSteps.portfolio, body: nextSteps.portfolioBody },
        ].map((step) => (
          <Link key={step.href} href={step.href} className="rounded-xl border border-line bg-card p-4 hover:border-primary">
            <p className="font-semibold text-primary">{step.title} →</p>
            <p className="mt-1 text-sm text-subtle">{step.body}</p>
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        <SavedAnalysis report={found.report} choices={found.choices} locale={locale} dict={analyze} />
      </div>
    </>
  );
}

export default function AnalysisPage({ params }: PageProps<"/[lang]/analyses/[id]">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Suspense fallback={<div className="h-96 rounded-xl border border-line bg-card" />}>
        <AnalysisDetail params={params} />
      </Suspense>
    </div>
  );
}
