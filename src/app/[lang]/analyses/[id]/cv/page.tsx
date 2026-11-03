import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CvEditor } from "@/components/cv/cv-editor";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getQuota } from "@/lib/analysis/service";
import { getSessionUser } from "@/lib/auth/session";
import { loadCvExport } from "@/lib/export/service";

async function RevisedCv({ params }: { params: PageProps<"/[lang]/analyses/[id]/cv">["params"] }) {
  const { id } = await params;
  const locale = await getLocale();
  const { cv: dict, analyze } = await getDictionary();

  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/analyses/${id}/cv`);
  const [cv, quota] = await Promise.all([loadCvExport(user.id, id), getQuota(user.id)]);
  if (!cv) notFound();
  const { resume } = cv.report;

  return (
    <>
      <Link href={`/${locale}/analyses/${id}`} className="text-sm text-subtle hover:text-foreground">
        ← {dict.back}
      </Link>
      <header className="mt-4 mb-6 grid gap-1">
        <h1 className="text-2xl font-semibold">{dict.title}</h1>
        <p className="text-sm text-subtle">{dict.subtitle}</p>
      </header>
      <CvEditor
        analysisId={id}
        document={cv.document}
        initialEdits={cv.edits}
        appliedCount={cv.revision.changed.size}
        unplacedCount={cv.revision.unplaced.length}
        showPhotoNote={resume.has_photo || resume.has_date_of_birth}
        locale={locale}
        quota={quota}
        dict={dict}
        analyzeDict={analyze}
      />
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
