import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { GithubProjectsForm } from "@/components/projects/github-projects-form";
import { ProjectProposals } from "@/components/projects/project-proposals";
import { format } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { getProjectImport } from "@/lib/projects/service";
import { projectsError } from "@/lib/projects/types";

async function GithubProjects({ params }: { params: PageProps<"/[lang]/analyses/[id]/projects">["params"] }) {
  const { id } = await params;
  const locale = await getLocale();
  const { projects: dict, analyze } = await getDictionary();

  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/analyses/${id}/projects`);
  const state = await getProjectImport(user.id, id);
  if (!state) notFound();

  return (
    <>
      <Link href={`/${locale}/analyses/${id}`} className="text-sm text-subtle hover:text-foreground">
        ← {dict.back}
      </Link>
      <header className="mt-4 mb-6 grid gap-1">
        <h1 className="text-2xl font-semibold">{dict.title}</h1>
        <p className="text-sm text-subtle">{dict.subtitle}</p>
        {state.status === "completed" && (
          <p className="mt-1 text-sm text-subtle">
            {format(dict.from, { source: state.source, count: state.result.considered })}
          </p>
        )}
      </header>

      {state.status === "completed" ? (
        <>
          <ProjectProposals
            analysisId={id}
            result={state.result}
            initialDecisions={state.decisions}
            cvHref={`/${locale}/analyses/${id}/cv`}
            dict={dict}
          />
          {state.result.proposals.length === 0 ? (
            <section className="mt-5 rounded-xl border border-line bg-card p-5 sm:p-6">
              <GithubProjectsForm
                analysisId={id}
                locale={locale}
                initialSource={state.source}
                dict={dict}
                errors={analyze.errors}
              />
            </section>
          ) : (
            <p className="mt-6 text-sm text-subtle">{dict.disclaimer}</p>
          )}
        </>
      ) : (
        <section className="grid gap-4 rounded-xl border border-line bg-card p-5 sm:p-6">
          {state.status === "running" && <p className="text-sm">{dict.running}</p>}
          {state.status === "failed" && (
            <p className="rounded-lg bg-warning-soft px-4 py-3 text-sm text-warning">
              {dict.failed} {state.errorCode && projectsError(state.errorCode, dict.errors, analyze.errors)}
            </p>
          )}
          {state.status !== "running" && (
            <GithubProjectsForm
              analysisId={id}
              locale={locale}
              initialSource={state.status === "failed" ? state.source : ""}
              dict={dict}
              errors={analyze.errors}
            />
          )}
        </section>
      )}
    </>
  );
}

export default function GithubProjectsPage({ params }: PageProps<"/[lang]/analyses/[id]/projects">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Suspense fallback={<div className="h-96 rounded-xl border border-line bg-card" />}>
        <GithubProjects params={params} />
      </Suspense>
    </div>
  );
}
