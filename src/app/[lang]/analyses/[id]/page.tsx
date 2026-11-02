import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SavedAnalysis } from "@/components/analyze/saved-analysis";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getAnalysisReport } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";

async function AnalysisDetail({ params }: { params: PageProps<"/[lang]/analyses/[id]">["params"] }) {
  const { id } = await params;
  const locale = await getLocale();
  const { analyze, history } = await getDictionary();

  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/analyses/${id}`);
  // Scoped to the user, so another user's analysis id is simply not found.
  const found = await getAnalysisReport(user.id, id);
  if (!found) notFound();

  return (
    <>
      <Link href={`/${locale}/history`} className="text-sm text-subtle hover:text-foreground">
        ← {history.back}
      </Link>
      <div className="mt-4">
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
