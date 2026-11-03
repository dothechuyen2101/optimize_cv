"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { format, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { requestAnalysis } from "@/lib/analysis/request";
import type { AnalysisErrorCode, AnalysisStage, SavedJob } from "@/lib/analysis/types";
import { hasQuotaLeft, type QuotaStatus } from "@/lib/billing/quota";
import { AnalyzeForm, type AnalyzeFormValues, type SavedJobOption } from "./analyze-form";

type State =
  | { status: "idle"; error?: AnalysisErrorCode }
  | { status: "running"; stage: AnalysisStage | null }
  | { status: "opening" };

interface Props {
  locale: Locale;
  dict: Dictionary["analyze"];
  quota: QuotaStatus;
  savedJobs: SavedJobOption[];
  initialJob: SavedJob | null;
}

export function AnalyzeWorkspace({ locale, dict, quota, savedJobs, initialJob }: Props) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "idle" });
  const outOfQuota = !hasQuotaLeft(quota);

  async function analyze(values: AnalyzeFormValues) {
    setState({ status: "running", stage: null });
    const body = new FormData();
    body.set("cv", values.file);
    body.set("jd", values.jd);
    body.set("market", values.market);
    body.set("lang", locale);
    if (values.parent) body.set("parent", values.parent);

    const outcome = await requestAnalysis(body, (stage) => setState({ status: "running", stage }));
    if ("error" in outcome) {
      setState({ status: "idle", error: outcome.error });
      return;
    }
    setState({ status: "opening" });
    router.push(`/${locale}/analyses/${outcome.analysisId}`);
  }

  return (
    <div className="grid gap-4">
      {quota.limit !== null && (
        <p className="text-sm text-subtle">
          {format(dict.quotaLeft, { remaining: Math.max(0, quota.limit - quota.used), limit: quota.limit })}
        </p>
      )}
      {state.status === "opening" ? (
        <p className="rounded-xl border border-line bg-card px-5 py-4 text-sm" aria-live="polite">
          {dict.opening}
        </p>
      ) : (
        <AnalyzeForm
          dict={dict}
          running={state.status === "running"}
          locked={outOfQuota}
          stage={state.status === "running" ? state.stage : null}
          error={state.status === "idle" ? (state.error ?? (outOfQuota ? "quota_exceeded" : undefined)) : undefined}
          savedJobs={savedJobs}
          initialJob={initialJob}
          onSubmit={analyze}
        />
      )}
    </div>
  );
}
