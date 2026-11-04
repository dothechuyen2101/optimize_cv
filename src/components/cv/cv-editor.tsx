"use client";

import { Fragment, useState, useTransition, type ReactNode } from "react";
import { WithPlaceholders } from "@/components/analyze/with-placeholders";
import { format, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { findPlaceholders } from "@/lib/analysis/types";
import type { QuotaStatus } from "@/lib/billing/quota";
import { saveCvEdit } from "@/lib/export/actions";
import { MAX_CV_TEXT, applyCvEdits, cvTexts, type CvDocument, type CvEdits, type CvText } from "@/lib/export/document";
import { cvFont } from "./cv-font";
import { ReevaluatePanel } from "./reevaluate-panel";

type CvDict = Dictionary["cv"];

const NOTICE_STYLE = { info: "bg-soft", warning: "bg-warning-soft text-warning", error: "bg-danger-soft text-danger" };

function Notice({ tone, children }: { tone: keyof typeof NOTICE_STYLE; children: ReactNode }) {
  return <p className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${NOTICE_STYLE[tone]}`}>{children}</p>;
}

interface Props {
  analysisId: string;
  /** The CV with accepted suggestions, before hand edits. */
  document: CvDocument;
  initialEdits: CvEdits;
  appliedCount: number;
  /** Projects added from the user's GitHub. */
  githubCount: number;
  unplacedCount: number;
  showPhotoNote: boolean;
  locale: Locale;
  quota: QuotaStatus;
  dict: CvDict;
  analyzeDict: Dictionary["analyze"];
}

/** The CV preview, where any line can be clicked and edited before downloading or re-evaluating. */
export function CvEditor({
  analysisId,
  document,
  initialEdits,
  appliedCount,
  githubCount,
  unplacedCount,
  showPhotoNote,
  locale,
  quota,
  dict,
  analyzeDict,
}: Props) {
  const [edits, setEdits] = useState(initialEdits);
  const [editing, setEditing] = useState<{ key: string; draft: string } | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [saving, startSaving] = useTransition();

  const doc = applyCvEdits(document, edits);
  const texts = cvTexts(doc);
  const originals = new Map(cvTexts(document).map((text) => [text.key, text.text]));
  const unfilled = texts.filter((text) => findPlaceholders(text.text).length > 0).length;
  const editedCount = texts.filter((text) => text.edited).length;
  // Header fields can be added even when the resume has none.
  const addLabels: Record<string, string> = {
    name: dict.addName,
    headline: dict.addHeadline,
    "contact.email": dict.addEmail,
    "contact.phone": dict.addPhone,
    "contact.location": dict.addLocation,
  };
  const shown = (text: CvText) => Boolean(text.text || originals.get(text.key) || addLabels[text.key]);

  function save(key: string, value: string) {
    const base = originals.get(key) ?? "";
    const text = value.replace(/\s+/g, " ").trim();
    const edit = text === base ? null : { base, value: text };
    setEdits((current) => {
      const next = { ...current };
      if (edit) next[key] = edit;
      else delete next[key];
      return next;
    });
    setEditing(null);
    startSaving(async () => {
      try {
        setSaveFailed(!(await saveCvEdit(analysisId, key, edit)));
      } catch {
        setSaveFailed(true);
      }
    });
  }

  /** A line of the CV: shown as a button that opens an inline editor. */
  function editable(text: CvText, { block = false } = {}) {
    if (!shown(text)) return null;
    const original = originals.get(text.key) ?? "";

    if (editing?.key === text.key) {
      return (
        <span className="my-1 block rounded-md bg-white p-2 ring-2 ring-sky-400">
          <textarea
            value={editing.draft}
            onChange={(event) => setEditing({ key: text.key, draft: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditing(null);
              if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                event.preventDefault();
                save(text.key, editing.draft);
              }
            }}
            aria-label={dict.editField}
            maxLength={MAX_CV_TEXT}
            rows={Math.max(1, Math.ceil(editing.draft.length / 80))}
            autoFocus
            className="block w-full resize-y rounded border border-neutral-300 bg-white px-2 py-1 text-neutral-900"
          />
          <span className="mt-2 flex flex-wrap gap-2 font-sans text-xs not-italic">
            <button
              type="button"
              onClick={() => save(text.key, editing.draft)}
              className="rounded bg-indigo-600 px-2.5 py-1 font-semibold text-white hover:bg-indigo-700"
            >
              {dict.save}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded px-2.5 py-1 text-neutral-600 hover:bg-neutral-100"
            >
              {dict.cancel}
            </button>
            {text.edited && (
              <button
                type="button"
                onClick={() => save(text.key, original)}
                className="rounded px-2.5 py-1 text-neutral-600 hover:bg-neutral-100"
              >
                {dict.restore}
              </button>
            )}
          </span>
        </span>
      );
    }

    const tint = text.edited ? "bg-sky-100" : text.changed ? "bg-emerald-100" : "";
    return (
      <button
        type="button"
        onClick={() => setEditing({ key: text.key, draft: text.text })}
        className={`${block ? "block w-full" : "inline"} cursor-text rounded text-left hover:bg-sky-50 hover:outline hover:outline-1 hover:outline-sky-300 ${tint}`}
      >
        {text.text ? (
          <WithPlaceholders text={text.text} className="bg-amber-200 text-amber-900" />
        ) : (
          <span className="font-normal not-italic text-neutral-400">{original ? dict.removed : addLabels[text.key]}</span>
        )}
      </button>
    );
  }

  const download = (fileFormat: "pdf" | "docx") => `/api/analyses/${analysisId}/cv?format=${fileFormat}`;
  const linkState = saving ? "pointer-events-none opacity-50" : "";

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={download("pdf")}
          download
          aria-disabled={saving}
          tabIndex={saving ? -1 : undefined}
          className={`rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90 ${linkState}`}
        >
          {dict.downloadPdf}
        </a>
        <a
          href={download("docx")}
          download
          aria-disabled={saving}
          tabIndex={saving ? -1 : undefined}
          className={`rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium hover:bg-soft ${linkState}`}
        >
          {dict.downloadDocx}
        </a>
        {saving && <span className="text-sm text-subtle">{dict.saving}</span>}
      </div>

      <div className="grid gap-2">
        <Notice tone="info">
          {appliedCount > 0 || githubCount > 0
            ? [
                appliedCount > 0 && format(dict.applied, { count: appliedCount }),
                githubCount > 0 && format(dict.githubAdded, { count: githubCount }),
              ]
                .filter(Boolean)
                .join(" ")
            : dict.noChanges}{" "}
          {editedCount > 0 && `${format(dict.editedCount, { count: editedCount })} `}
          {dict.templateNote}
        </Notice>
        <Notice tone="info">{dict.editTip}</Notice>
        {saveFailed && <Notice tone="error">{dict.saveFailed}</Notice>}
        {unfilled > 0 && <Notice tone="warning">{format(dict.unfilled, { count: unfilled })}</Notice>}
        {unplacedCount > 0 && <Notice tone="warning">{format(dict.unplaced, { count: unplacedCount })}</Notice>}
        {showPhotoNote && <Notice tone="info">{dict.photoNote}</Notice>}
      </div>

      <ReevaluatePanel
        analysisId={analysisId}
        locale={locale}
        quota={quota}
        hasChanges={appliedCount > 0 || githubCount > 0 || editedCount > 0}
        blocked={saving || editing !== null}
        dict={dict}
        analyzeDict={analyzeDict}
      />

      {/* A white page in light and dark mode alike, like the file it previews. */}
      <article
        lang={doc.language}
        className={`${cvFont.className} mx-auto w-full max-w-[210mm] rounded-sm bg-white px-6 py-8 text-[13px] leading-[1.45] text-neutral-800 shadow-sm ring-1 ring-black/5 sm:px-12 sm:py-12`}
      >
        <h2 className="text-center text-2xl font-bold text-neutral-900">{editable(doc.name)}</h2>
        <p className="mt-0.5 text-center text-sm">{editable(doc.headline)}</p>
        <p className="mt-1.5 break-words text-center text-xs text-neutral-600">
          {doc.contact.filter(shown).map((text, index) => (
            <Fragment key={text.key}>
              {index > 0 && <span aria-hidden> · </span>}
              {editable(text)}
            </Fragment>
          ))}
        </p>

        {doc.sections.map((section) => (
          <section key={section.key} className="mt-5">
            <h3 className="mb-2 border-b border-neutral-400 pb-0.5 text-[13.5px] font-bold uppercase tracking-wide text-neutral-900">
              {section.heading}
            </h3>
            {section.entries.map((entry, entryIndex) => (
              <div key={entryIndex} className="mb-3 last:mb-0">
                {(shown(entry.title) || shown(entry.dates)) && (
                  <div className="flex flex-wrap justify-between gap-x-4">
                    <span className="font-bold">{editable(entry.title)}</span>
                    <span className="text-neutral-600">{editable(entry.dates)}</span>
                  </div>
                )}
                {shown(entry.subtitle) && <p className="italic text-neutral-700">{editable(entry.subtitle)}</p>}
                {entry.paragraphs.map((paragraph) => (
                  <div key={paragraph.key} className="mt-0.5">
                    {editable(paragraph, { block: true })}
                  </div>
                ))}
                {entry.bullets.length > 0 && (
                  <ul className="mt-0.5 list-disc pl-5">
                    {entry.bullets.map((bullet) => (
                      <li key={bullet.key} className="mt-0.5">
                        {editable(bullet, { block: true })}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
