import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AnalyzeWorkspace } from "@/components/analyze/analyze-workspace";
import type { Locale } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import type { Dictionary } from "@/i18n/types";
import { getQuota, getSavedJob, listSavedJobs } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";

interface WorkspaceProps {
  locale: Locale;
  dict: Dictionary["analyze"];
  searchParams: PageProps<"/[lang]/analyze">["searchParams"];
}

async function SignedInWorkspace({ locale, dict, searchParams }: WorkspaceProps) {
  // ?from=<analysis id> starts from that analysis's JD, e.g. to upload a CV revised outside the app.
  const { from } = await searchParams;
  const fromId = typeof from === "string" ? from : null;
  const user = await getSessionUser();
  if (!user) {
    const next = `/${locale}/analyze${fromId ? `?from=${fromId}` : ""}`;
    redirect(`/${locale}/login?next=${encodeURIComponent(next)}`);
  }

  const [quota, savedJobs, initialJob] = await Promise.all([
    getQuota(user.id),
    listSavedJobs(user.id),
    fromId ? getSavedJob(user.id, fromId) : null,
  ]);
  const date = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-GB", {
    dateStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  });
  return (
    <AnalyzeWorkspace
      locale={locale}
      dict={dict}
      quota={quota}
      savedJobs={savedJobs.map((job) => ({ ...job, usedAt: date.format(job.usedAt) }))}
      initialJob={initialJob}
    />
  );
}

export default async function AnalyzePage({ searchParams }: PageProps<"/[lang]/analyze">) {
  const locale = await getLocale();
  const { analyze } = await getDictionary();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{analyze.title}</h1>
      <p className="mt-2 text-subtle">{analyze.subtitle}</p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-96 rounded-xl border border-line bg-card" />}>
          <SignedInWorkspace locale={locale} dict={analyze} searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}
