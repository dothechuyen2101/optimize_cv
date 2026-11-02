"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { format, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import type { AnalysisErrorCode, AnalysisEvent, AnalysisStage } from "@/lib/analysis/types";
import { hasQuotaLeft, type QuotaStatus } from "@/lib/billing/quota";
import { AnalyzeForm, type AnalyzeFormValues } from "./analyze-form";

type State =
  | { status: "idle"; error?: AnalysisErrorCode }
  | { status: "running"; stage: AnalysisStage | null }
  | { status: "opening" };

async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AnalysisEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) yield JSON.parse(line) as AnalysisEvent;
    }
  }
}

interface Props {
  locale: Locale;
  dict: Dictionary["analyze"];
  quota: QuotaStatus;
}

export function AnalyzeWorkspace({ locale, dict, quota }: Props) {
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

    try {
      const response = await fetch("/api/analyze", { method: "POST", body });
      if (!response.ok || !response.body) {
        const event = (await response.json().catch(() => null)) as AnalysisEvent | null;
        setState({ status: "idle", error: event?.type === "error" ? event.code : "server" });
        return;
      }
      for await (const event of readEvents(response.body)) {
        if (event.type === "stage") {
          setState({ status: "running", stage: event.stage });
        } else if (event.type === "result") {
          setState({ status: "opening" });
          router.push(`/${locale}/analyses/${event.analysisId}`);
          return;
        } else {
          setState({ status: "idle", error: event.code });
          return;
        }
      }
      // The stream closed without a result, e.g. the function timed out.
      setState({ status: "idle", error: "server" });
    } catch {
      setState({ status: "idle", error: "server" });
    }
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
          onSubmit={analyze}
        />
      )}
    </div>
  );
}
