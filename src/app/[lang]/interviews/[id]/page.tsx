import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { InterviewChat } from "@/components/interview/interview-chat";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getSessionUser } from "@/lib/auth/session";
import { loadInterview } from "@/lib/interview/service";

async function Session({ params }: { params: PageProps<"/[lang]/interviews/[id]">["params"] }) {
  const { id } = await params;
  const locale = await getLocale();
  const { interview: dict, analyze } = await getDictionary();

  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/interviews/${id}`);
  const interview = await loadInterview(user.id, id);
  if (!interview) notFound();
  const { job, settings } = interview;
  const chip = "rounded-full bg-soft px-2.5 py-0.5 text-xs font-medium text-primary";

  return (
    <>
      <Link href={`/${locale}/interviews`} className="text-sm text-subtle hover:text-foreground">
        ← {dict.listTitle}
      </Link>
      <header className="mt-4 mb-6 grid gap-2">
        <h1 className="text-2xl font-semibold">
          {job.title}
          {job.company && <span className="font-normal text-subtle"> · {job.company}</span>}
        </h1>
        <div className="flex flex-wrap gap-2">
          <span className={chip}>{dict.types[settings.type]}</span>
          <span className={chip}>{dict.difficulties[settings.difficulty]}</span>
          <span className={chip}>{dict.languages[settings.language]}</span>
        </div>
      </header>
      <InterviewChat
        sessionId={id}
        initialTurns={interview.turns}
        initialReport={interview.report}
        newSessionHref={`/${locale}/analyses/${interview.analysisId}/interview`}
        dict={dict}
        errors={analyze.errors}
      />
    </>
  );
}

export default function InterviewPage({ params }: PageProps<"/[lang]/interviews/[id]">) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Suspense fallback={<div className="h-96 rounded-xl border border-line bg-card" />}>
        <Session params={params} />
      </Suspense>
    </div>
  );
}
