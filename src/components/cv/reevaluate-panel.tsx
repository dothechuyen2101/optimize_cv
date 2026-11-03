"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { format, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { requestAnalysis } from "@/lib/analysis/request";
import type { AnalysisErrorCode, AnalysisStage } from "@/lib/analysis/types";
import { COMPONENT_WEIGHTS, type AtsComponentKey, type AtsResult } from "@/lib/ats/score";
import { hasQuotaLeft, type QuotaStatus } from "@/lib/billing/quota";
import { rescoreCv } from "@/lib/export/actions";

const STAGES: AnalysisStage[] = ["parsing", "scoring", "analyzing"];

type AiState =
  | { status: "idle"; error?: AnalysisErrorCode }
  | { status: "running"; stage: AnalysisStage | null }
  | { status: "opening" };

function Delta({ before, after, unchanged }: { before: number; after: number; unchanged: string }) {
  const delta = after - before;
  if (delta === 0) return <span className="text-subtle">({unchanged})</span>;
  return (
    <span className={`font-semibold ${delta > 0 ? "text-success" : "text-danger"}`}>
      ({delta > 0 ? "+" : ""}
      {delta})
    </span>
  );
}

function Missing({ label, terms }: { label: string; terms: string[] }) {
  if (terms.length === 0) return null;
  return (
    <div className="grid gap-1.5 sm:grid-cols-[10rem_1fr]">
      <span className="text-xs text-subtle">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {terms.map((term) => (
          <span key={term} className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger">
            {term}
          </span>
        ))}
      </div>
    </div>
  );
}

interface Props {
  analysisId: string;
  locale: Locale;
  quota: QuotaStatus;
  /** Whether any suggestion or hand edit changed the CV. */
  hasChanges: boolean;
  /** A line is open in the editor or an edit is still saving, so the stored CV isn't final yet. */
  blocked: boolean;
  dict: Dictionary["cv"];
  analyzeDict: Dictionary["analyze"];
}

/** Scores the revised CV again for free, or re-analyzes it with AI as a new analysis. */
export function ReevaluatePanel({ analysisId, locale, quota, hasChanges, blocked, dict, analyzeDict }: Props) {
  const router = useRouter();
  const [score, setScore] = useState<{ before: AtsResult; after: AtsResult } | null>(null);
  const [scoreFailed, setScoreFailed] = useState(false);
  const [scoring, startScoring] = useTransition();
  const [ai, setAi] = useState<AiState>({ status: "idle" });
  const busy = blocked || scoring || ai.status !== "idle";
  const outOfQuota = !hasQuotaLeft(quota);
  const result = analyzeDict.result;

  function rescore() {
    startScoring(async () => {
      try {
        const next = await rescoreCv(analysisId);
        setScore(next);
        setScoreFailed(next === null);
      } catch {
        setScoreFailed(true);
      }
    });
  }

  async function reanalyze() {
    setAi({ status: "running", stage: null });
    const body = new FormData();
    body.set("from", analysisId);
    body.set("lang", locale);
    const outcome = await requestAnalysis(body, (stage) => setAi({ status: "running", stage }));
    if ("error" in outcome) {
      setAi({ status: "idle", error: outcome.error });
      return;
    }
    setAi({ status: "opening" });
    router.push(`/${locale}/analyses/${outcome.analysisId}`);
  }

  const quotaNote =
    quota.limit === null
      ? dict.reanalyzeUnlimited
      : format(dict.reanalyzeQuota, { remaining: Math.max(0, quota.limit - quota.used), limit: quota.limit });

  return (
    <section className="grid gap-4 rounded-xl border border-line bg-card p-5 sm:p-6">
      <div className="grid gap-1">
        <h2 className="text-lg font-semibold">{dict.reevaluateTitle}</h2>
        <p className="text-sm text-subtle">{dict.reevaluateBody}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={rescore}
          disabled={busy}
          className="rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium hover:bg-soft disabled:opacity-50"
        >
          {scoring ? dict.rescoring : dict.rescore}
        </button>
        <button
          type="button"
          onClick={reanalyze}
          disabled={busy || outOfQuota || !hasChanges}
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
        >
          {dict.reanalyze}
        </button>
      </div>
      <p className="text-xs text-subtle">
        {blocked ? dict.finishEditing : hasChanges ? quotaNote : dict.noChangesToAnalyze}
      </p>

      {ai.status === "running" && (
        <ol className="flex flex-wrap gap-3 text-sm" aria-live="polite">
          {STAGES.map((item) => {
            const reached = ai.stage !== null && STAGES.indexOf(item) <= STAGES.indexOf(ai.stage);
            return (
              <li key={item} className={reached ? "font-medium" : "text-subtle"}>
                {item === ai.stage ? "● " : reached ? "✓ " : "○ "}
                {analyzeDict.progress[item]}
              </li>
            );
          })}
        </ol>
      )}
      {ai.status === "opening" && (
        <p className="text-sm" aria-live="polite">
          {analyzeDict.opening}
        </p>
      )}
      {ai.status === "idle" && ai.error && (
        <p className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{analyzeDict.errors[ai.error]}</p>
      )}
      {scoreFailed && <p className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{dict.rescoreFailed}</p>}

      {score && (
        <div className="grid gap-4 rounded-lg bg-soft p-4" aria-live="polite">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <span>{dict.scoreLabel}</span>
            <span className="text-2xl font-semibold tabular-nums">
              {score.before.overall} → {score.after.overall}
            </span>
            <Delta before={score.before.overall} after={score.after.overall} unchanged={dict.unchanged} />
          </p>
          <dl className="grid gap-1 text-sm">
            {(Object.keys(COMPONENT_WEIGHTS) as AtsComponentKey[]).map((key) => {
              const [before, after] = [score.before.components[key], score.after.components[key]];
              if (before === null || after === null) return null;
              return (
                <div key={key} className="grid grid-cols-[9rem_1fr] gap-3">
                  <dt className="text-subtle">{result.breakdown[key]}</dt>
                  <dd className="tabular-nums">
                    {before} → {after} <Delta before={before} after={after} unchanged={dict.unchanged} />
                  </dd>
                </div>
              );
            })}
          </dl>
          <Missing label={`${result.breakdown.required} · ${result.missing}`} terms={score.after.coverage.required.missing} />
          <Missing label={`${result.breakdown.keywords} · ${result.missing}`} terms={score.after.coverage.keywords.missing} />
          <p className="text-xs text-subtle">{dict.rescoreNote}</p>
        </div>
      )}
    </section>
  );
}
