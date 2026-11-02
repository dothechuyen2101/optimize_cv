import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { CvPreview } from "@/components/cv/cv-preview";
import { format } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getAnalysisReport } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";
import { buildCvDocument } from "@/lib/export/document";
import { reviseResume } from "@/lib/export/revise";

const NOTICE_STYLE = { info: "bg-soft", warning: "bg-warning-soft text-warning" };

function Notice({ tone, children }: { tone: keyof typeof NOTICE_STYLE; children: ReactNode }) {
  return <p className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${NOTICE_STYLE[tone]}`}>{children}</p>;
}

async function RevisedCv({ params }: { params: PageProps<"/[lang]/analyses/[id]/cv">["params"] }) {
  const { id } = await params;
  const locale = await getLocale();
  const { cv: dict } = await getDictionary();

  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/analyses/${id}/cv`);
  const found = await getAnalysisReport(user.id, id);
  if (!found) notFound();

  const { resume, analysis } = found.report;
  const revision = reviseResume(resume, analysis, found.choices);
  const download = (fileFormat: "pdf" | "docx") => `/api/analyses/${id}/cv?format=${fileFormat}`;

  return (
    <>
      <Link href={`/${locale}/analyses/${id}`} className="text-sm text-subtle hover:text-foreground">
        ← {dict.back}
      </Link>
      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">{dict.title}</h1>
          <p className="text-sm text-subtle">{dict.subtitle}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <a
            href={download("pdf")}
            download
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90"
          >
            {dict.downloadPdf}
          </a>
          <a
            href={download("docx")}
            download
            className="rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium hover:bg-soft"
          >
            {dict.downloadDocx}
          </a>
        </div>
      </header>

      <div className="mt-6 grid gap-2">
        <Notice tone="info">
          {revision.changed.size > 0 ? format(dict.applied, { count: revision.changed.size }) : dict.noChanges}{" "}
          {dict.templateNote}
        </Notice>
        {revision.unfilled.length > 0 && (
          <Notice tone="warning">{format(dict.unfilled, { count: revision.unfilled.length })}</Notice>
        )}
        {revision.unplaced.length > 0 && (
          <Notice tone="warning">{format(dict.unplaced, { count: revision.unplaced.length })}</Notice>
        )}
        {(resume.has_photo || resume.has_date_of_birth) && <Notice tone="info">{dict.photoNote}</Notice>}
      </div>

      <div className="mt-6">
        <CvPreview doc={buildCvDocument(revision)} />
      </div>
    </>
  );
}

export default function RevisedCvPage({ params }: PageProps<"/[lang]/analyses/[id]/cv">) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Suspense fallback={<div className="h-96 rounded-xl border border-line bg-card" />}>
        <RevisedCv params={params} />
      </Suspense>
    </div>
  );
}
