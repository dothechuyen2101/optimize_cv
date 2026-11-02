import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AnalyzeWorkspace } from "@/components/analyze/analyze-workspace";
import type { Locale } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import type { Dictionary } from "@/i18n/types";
import { getQuota } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";

async function SignedInWorkspace({ locale, dict }: { locale: Locale; dict: Dictionary["analyze"] }) {
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/analyze`);
  const quota = await getQuota(user.id);
  return <AnalyzeWorkspace locale={locale} dict={dict} quota={quota} />;
}

export default async function AnalyzePage() {
  const locale = await getLocale();
  const { analyze } = await getDictionary();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{analyze.title}</h1>
      <p className="mt-2 text-subtle">{analyze.subtitle}</p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-96 rounded-xl border border-line bg-card" />}>
          <SignedInWorkspace locale={locale} dict={analyze} />
        </Suspense>
      </div>
    </div>
  );
}
