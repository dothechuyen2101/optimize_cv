"use client";

import { useState, type DragEvent, type FormEvent } from "react";
import { format } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { loadSavedJob } from "@/lib/analysis/actions";
import {
  JD_MAX_CHARS,
  JD_MIN_CHARS,
  type AnalysisErrorCode,
  type AnalysisStage,
  type SavedJob,
} from "@/lib/analysis/types";

export interface AnalyzeFormValues {
  file: File;
  jd: string;
  market: "auto" | "vn" | "international";
  /** The earlier analysis of the same JD to compare the result with. */
  parent?: string;
}

/** A JD from the user's history, listed without its text. */
export interface SavedJobOption {
  analysisId: string;
  title: string | null;
  company: string | null;
  usedAt: string;
}

const ACCEPT = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";
const MAX_BYTES = 5 * 1024 * 1024;
const STAGES: AnalysisStage[] = ["parsing", "scoring", "analyzing"];

interface Props {
  dict: Dictionary["analyze"];
  running: boolean;
  /** No quota left: the form stays visible but can't be submitted. */
  locked: boolean;
  stage: AnalysisStage | null;
  error?: AnalysisErrorCode;
  savedJobs: SavedJobOption[];
  /** A JD to start from, e.g. when re-uploading a CV revised outside the app. */
  initialJob: SavedJob | null;
  onSubmit: (values: AnalyzeFormValues) => void;
}

export function AnalyzeForm({ dict, running, locked, stage, error, savedJobs, initialJob, onSubmit }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState(initialJob?.jd ?? "");
  const [market, setMarket] = useState<AnalyzeFormValues["market"]>(initialJob?.market ?? "auto");
  const [job, setJob] = useState<SavedJob | null>(initialJob);
  const [selected, setSelected] = useState(
    savedJobs.some((option) => option.analysisId === initialJob?.analysisId) ? (initialJob?.analysisId ?? "") : "",
  );
  const [loadingJob, setLoadingJob] = useState(false);
  const [jobFailed, setJobFailed] = useState(false);
  const [localError, setLocalError] = useState<AnalysisErrorCode | null>(null);
  const [dragging, setDragging] = useState(false);
  const jobLabel = (option: { title: string | null; company: string | null }) =>
    [option.title, option.company].filter(Boolean).join(" · ") || dict.savedJobUntitled;

  async function applySavedJob(analysisId: string) {
    setSelected(analysisId);
    setJobFailed(false);
    if (!analysisId) {
      setJob(null);
      return;
    }
    setLoadingJob(true);
    try {
      const saved = await loadSavedJob(analysisId);
      if (!saved) throw new Error("JD not found");
      setJd(saved.jd);
      setMarket(saved.market);
      setJob(saved);
    } catch {
      setJobFailed(true);
    } finally {
      setLoadingJob(false);
    }
  }

  function pick(candidate: File | undefined) {
    if (!candidate) return;
    setLocalError(candidate.size > MAX_BYTES ? "file_too_large" : null);
    setFile(candidate);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    pick(event.dataTransfer.files[0]);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = jd.trim();
    const problem: AnalysisErrorCode | null = !file
      ? "missing_file"
      : file.size > MAX_BYTES
        ? "file_too_large"
        : trimmed.length < JD_MIN_CHARS
          ? "jd_too_short"
          : trimmed.length > JD_MAX_CHARS
            ? "jd_too_long"
            : null;
    setLocalError(problem);
    if (!problem && file) onSubmit({ file, jd: trimmed, market, parent: job?.analysisId });
  }

  const shownError = localError ?? error;

  return (
    <form onSubmit={submit} className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-2">
          <span className="text-sm font-medium">{dict.cvLabel}</span>
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex min-h-48 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition ${
              dragging ? "border-primary bg-soft" : "border-line bg-card hover:border-primary"
            }`}
          >
            <input
              type="file"
              accept={ACCEPT}
              className="sr-only"
              disabled={running}
              onChange={(event) => pick(event.target.files?.[0])}
            />
            <span className="text-sm font-medium">{file ? format(dict.cvSelected, { name: file.name }) : dict.cvDrop}</span>
            <span className="text-xs text-subtle">{dict.cvHint}</span>
          </label>

          <label className="mt-4 grid gap-2">
            <span className="text-sm font-medium">{dict.marketLabel}</span>
            <select
              value={market}
              disabled={running}
              onChange={(event) => setMarket(event.target.value as AnalyzeFormValues["market"])}
              className="rounded-lg border border-line bg-card px-3 py-2 text-sm"
            >
              <option value="auto">{dict.marketAuto}</option>
              <option value="vn">{dict.marketVn}</option>
              <option value="international">{dict.marketIntl}</option>
            </select>
          </label>
        </div>

        <div className="grid content-start gap-2">
          {savedJobs.length > 0 && (
            <label className="grid gap-1.5">
              <span className="text-sm font-medium">{dict.savedJobs}</span>
              <select
                value={selected}
                disabled={running || loadingJob}
                onChange={(event) => applySavedJob(event.target.value)}
                className="rounded-lg border border-line bg-card px-3 py-2 text-sm"
              >
                <option value="">{dict.savedJobsPlaceholder}</option>
                {savedJobs.map((option) => (
                  <option key={option.analysisId} value={option.analysisId}>
                    {jobLabel(option)} — {option.usedAt}
                  </option>
                ))}
              </select>
              {loadingJob && <span className="text-xs text-subtle">{dict.savedJobLoading}</span>}
              {jobFailed && <span className="text-xs text-danger">{dict.savedJobFailed}</span>}
            </label>
          )}
          {job && (
            <p className="rounded-lg bg-soft px-3 py-2 text-xs leading-relaxed">
              {format(dict.comparingWith, { job: jobLabel(job) })}
            </p>
          )}
          <label className="grid content-start gap-2">
            <span className="text-sm font-medium">{dict.jdLabel}</span>
            <textarea
              value={jd}
              disabled={running}
              onChange={(event) => setJd(event.target.value)}
              placeholder={dict.jdPlaceholder}
              rows={14}
              className="min-h-72 resize-y rounded-xl border border-line bg-card p-4 text-sm leading-relaxed"
            />
            <span className="text-xs text-subtle">
              {format(dict.jdHint, { min: JD_MIN_CHARS, count: jd.trim().length })}
            </span>
          </label>
        </div>
      </div>

      {shownError && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          {dict.errors[shownError]}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={running || locked}
          className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-fg shadow-sm hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {running ? dict.submitting : dict.submit}
        </button>
        {running && (
          <ol className="flex flex-wrap gap-3 text-sm" aria-live="polite">
            {STAGES.map((item) => {
              const reached = stage !== null && STAGES.indexOf(item) <= STAGES.indexOf(stage);
              return (
                <li key={item} className={reached ? "font-medium text-foreground" : "text-subtle"}>
                  {item === stage ? "● " : reached ? "✓ " : "○ "}
                  {dict.progress[item]}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </form>
  );
}
