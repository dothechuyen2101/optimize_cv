"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import type { AnalysisErrorCode } from "@/lib/analysis/types";

interface Props {
  analysisId: string;
  locale: Locale;
  dict: Dictionary["role"];
  errors: Dictionary["analyze"]["errors"];
}

/** Generates the role analysis, then reloads the page to show it. */
export function GenerateRoleButton({ analysisId, locale, dict, errors }: Props) {
  const router = useRouter();
  const [state, setState] = useState<{ status: "idle"; error?: AnalysisErrorCode } | { status: "running" }>({
    status: "idle",
  });

  async function generate() {
    setState({ status: "running" });
    try {
      const response = await fetch(`/api/analyses/${analysisId}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: locale }),
      });
      const body = (await response.json().catch(() => null)) as { code?: AnalysisErrorCode } | null;
      // 409: another request is generating it; showing the page again reports that.
      if (response.ok || response.status === 409) {
        router.refresh();
        return;
      }
      setState({ status: "idle", error: body?.code ?? "server" });
    } catch {
      setState({ status: "idle", error: "server" });
    }
  }

  const running = state.status === "running";
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={generate}
          disabled={running}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        >
          {dict.generate}
        </button>
        <span className="text-sm text-subtle" aria-live="polite">
          {running ? dict.generating : dict.generateNote}
        </span>
      </div>
      {state.status === "idle" && state.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          {errors[state.error]}
        </p>
      )}
    </div>
  );
}
