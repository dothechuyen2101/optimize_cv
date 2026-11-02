"use client";

import { startTransition } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { saveSuggestionDecision } from "@/lib/analysis/actions";
import type { AnalysisReport, Decision } from "@/lib/analysis/types";
import { AnalysisResult } from "./analysis-result";

interface Props {
  report: AnalysisReport;
  decisions: Record<number, Decision>;
  locale: Locale;
  dict: Dictionary["analyze"];
}

/** A stored analysis whose accept/skip choices are saved as the user makes them. */
export function SavedAnalysis({ report, decisions, locale, dict }: Props) {
  return (
    <AnalysisResult
      report={report}
      dict={dict}
      newAnalysisHref={`/${locale}/analyze`}
      initialDecisions={decisions}
      onDecisionChange={(index, decision) => startTransition(() => saveSuggestionDecision(report.id, index, decision))}
    />
  );
}
