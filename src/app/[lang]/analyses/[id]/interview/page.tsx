import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { InterviewSetup } from "@/components/interview/interview-setup";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getAnalysisReport } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";
import { getQuota } from "@/lib/billing/limits";

async function Setup({ params }: { params: PageProps<"/[lang]/analyses/[id]/interview">["params"] }) {
  const { id } = await params;
  const locale = await getLocale();
  const { interview: dict, analyze } = await getDictionary();

  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/analyses/${id}/interview`);
  const [found, quota] = await Promise.all([getAnalysisReport(user.id, id), getQuota(user.id)]);
  if (!found) notFound();
  const { job } = found.report;

  return (
    <>
      <Link href={`/${locale}/analyses/${id}`} className="text-sm text-subtle hover:text-foreground">
        ← {dict.back}
      </Link>
      <header className="mt-4 mb-6 grid gap-1">
        <h1 className="text-2xl font-semibold">{dict.setupTitle}</h1>
        <p className="text-sm font-medium">
          {job.title}
          {job.company && <span className="font-normal text-subtle"> · {job.company}</span>}
        </p>
        <p className="text-sm text-subtle">{dict.setupSubtitle}</p>
      </header>
      <InterviewSetup
        analysisId={id}
        locale={locale}
        quota={quota}
        defaultLanguage={job.detected_language === "vi" ? "vi" : "en"}
        dict={dict}
        errors={analyze.errors}
      />
    </>
  );
}

export default function InterviewSetupPage({ params }: PageProps<"/[lang]/analyses/[id]/interview">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Suspense fallback={<div className="h-72 rounded-xl border border-line bg-card" />}>
        <Setup params={params} />
      </Suspense>
    </div>
  );
}
