"use client";

import { startTransition } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { saveSuggestionChoice } from "@/lib/analysis/actions";
import type { AnalysisReport, Choices } from "@/lib/analysis/types";
import { AnalysisResult } from "./analysis-result";

interface Props {
  report: AnalysisReport;
  choices: Choices;
  locale: Locale;
  dict: Dictionary["analyze"];
}

/** A stored analysis whose accept/skip/edit choices are saved as the user makes them. */
export function SavedAnalysis({ report, choices, locale, dict }: Props) {
  return (
    <AnalysisResult
      report={report}
      dict={dict}
      newAnalysisHref={`/${locale}/analyze`}
      exportHref={`/${locale}/analyses/${report.id}/cv`}
      previousHref={report.previous ? `/${locale}/analyses/${report.previous.id}` : undefined}
      initialChoices={choices}
      onChoiceChange={(target, choice) => startTransition(() => saveSuggestionChoice(report.id, target, choice))}
    />
  );
}
