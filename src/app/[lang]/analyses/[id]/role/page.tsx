import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { GenerateRoleButton } from "@/components/role/generate-role-button";
import { RoleReportView } from "@/components/role/role-report-view";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { getRoleReport } from "@/lib/role/service";

async function RoleAnalysis({ params }: { params: PageProps<"/[lang]/analyses/[id]/role">["params"] }) {
  const { id } = await params;
  const locale = await getLocale();
  const { role: dict, analyze } = await getDictionary();

  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/analyses/${id}/role`);
  const state = await getRoleReport(user.id, id);
  if (!state) notFound();

  return (
    <>
      <Link href={`/${locale}/analyses/${id}`} className="text-sm text-subtle hover:text-foreground">
        ← {dict.back}
      </Link>
      <header className="mt-4 mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">{dict.title}</h1>
          <p className="text-sm text-subtle">{dict.subtitle}</p>
        </div>
        {state.status === "completed" && (
          <Link
            href={`/${locale}/analyses/${id}/interview`}
            className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-fg hover:opacity-90"
          >
            {dict.practiceCta}
          </Link>
        )}
      </header>

      {state.status === "completed" ? (
        <>
          <RoleReportView report={state.report} dict={dict} />
          <p className="mt-6 text-sm text-subtle">{dict.disclaimer}</p>
        </>
      ) : (
        <section className="grid gap-4 rounded-xl border border-line bg-card p-5 sm:p-6">
          {state.status === "running" && <p className="text-sm">{dict.running}</p>}
          {state.status === "failed" && <p className="text-sm text-warning">{dict.failed}</p>}
          {state.status !== "running" && (
            <GenerateRoleButton analysisId={id} locale={locale} dict={dict} errors={analyze.errors} />
          )}
        </section>
      )}
    </>
  );
}

export default function RolePage({ params }: PageProps<"/[lang]/analyses/[id]/role">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Suspense fallback={<div className="h-96 rounded-xl border border-line bg-card" />}>
        <RoleAnalysis params={params} />
      </Suspense>
    </div>
  );
}
