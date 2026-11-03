"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { format } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import type { BulletSuggestion } from "@/lib/ai/schemas/analysis";
import type { Resume } from "@/lib/ai/schemas/resume";
import type { AnalysisReport, Choice, Choices, SuggestionTarget } from "@/lib/analysis/types";
import { COMPONENT_WEIGHTS, type AtsComponentKey, type TermCoverage } from "@/lib/ats/score";
import { CopyButton } from "./copy-button";
import { ScoreRing, scoreTone } from "./score-ring";
import { SuggestionCard } from "./suggestion-card";

type ResultDict = Dictionary["analyze"]["result"];

const TONE_BAR = { success: "bg-success", warning: "bg-warning", danger: "bg-danger" };
const SEVERITY_STYLE = {
  critical: "bg-danger-soft text-danger",
  major: "bg-warning-soft text-warning",
  minor: "bg-soft text-subtle",
};
const ISSUE_DOT = { high: "bg-danger", medium: "bg-warning", low: "bg-subtle" };

function suggestionContext(suggestion: BulletSuggestion, resume: Resume, dict: ResultDict): string {
  if (suggestion.section === "experience") {
    const item = resume.experiences[suggestion.item_index];
    return item ? `${dict.section.experience} · ${item.title} · ${item.company}` : dict.section.experience;
  }
  const item = resume.projects[suggestion.item_index];
  return item ? `${dict.section.project} · ${item.name}` : dict.section.project;
}

function Card({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        {aside}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Chips({ terms, tone }: { terms: string[]; tone: "success" | "danger" }) {
  const style = tone === "success" ? "bg-success-soft text-success" : "bg-danger-soft text-danger";
  return (
    <div className="flex flex-wrap gap-1.5">
      {terms.map((term) => (
        <span key={term} className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
          {term}
        </span>
      ))}
    </div>
  );
}

function CoverageRow({ label, coverage, dict }: { label: string; coverage: TermCoverage; dict: ResultDict }) {
  if (coverage.matched.length + coverage.missing.length === 0) return null;
  return (
    <div className="grid gap-2 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-medium">{label}</h3>
      {coverage.missing.length > 0 && (
        <div className="grid gap-1.5 sm:grid-cols-[6rem_1fr]">
          <span className="text-xs text-subtle">{dict.missing}</span>
          <Chips terms={coverage.missing} tone="danger" />
        </div>
      )}
      {coverage.matched.length > 0 && (
        <div className="grid gap-1.5 sm:grid-cols-[6rem_1fr]">
          <span className="text-xs text-subtle">{dict.matched}</span>
          <Chips terms={coverage.matched} tone="success" />
        </div>
      )}
    </div>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-2 text-sm leading-relaxed">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const NO_CHOICES: Choices = { bullets: {}, summary: null };

interface Props {
  report: AnalysisReport;
  dict: Dictionary["analyze"];
  newAnalysisHref: string;
  /** Page that previews and downloads the resume with the accepted suggestions. */
  exportHref: string;
  /** The analysis this one re-evaluates, when there is one. */
  previousHref?: string;
  initialChoices?: Choices;
  /** Called after each accept/skip/edit/undo so the choice can be saved. */
  onChoiceChange?: (target: SuggestionTarget, choice: Choice | null) => void;
}

export function AnalysisResult({
  report,
  dict: analyzeDict,
  newAnalysisHref,
  exportHref,
  previousHref,
  initialChoices = NO_CHOICES,
  onChoiceChange,
}: Props) {
  const dict = analyzeDict.result;
  const { ats, analysis, resume, job } = report;
  const [choices, setChoices] = useState<Choices>(initialChoices);

  const suggestions = analysis.bullet_suggestions;
  const acceptedLines = suggestions.flatMap((suggestion, index) => {
    const choice = choices.bullets[index];
    return choice?.decision === "accepted" ? [choice.text ?? suggestion.proposed] : [];
  });
  const acceptedText = acceptedLines.map((line) => `• ${line}`).join("\n");
  const changeCount = acceptedLines.length + (choices.summary?.decision === "accepted" ? 1 : 0);

  function choose(target: SuggestionTarget, choice: Choice | null) {
    setChoices((current) => {
      if (target.kind === "summary") return { ...current, summary: choice };
      const bullets = { ...current.bullets };
      if (choice) bullets[target.index] = choice;
      else delete bullets[target.index];
      return { ...current, bullets };
    });
    onChoiceChange?.(target, choice);
  }

  return (
    <div className="grid gap-6">
      <section className="flex flex-col gap-6 rounded-xl border border-line bg-card p-5 sm:flex-row sm:p-6">
        <ScoreRing score={ats.overall} label={dict.overall} />
        <div className="grid flex-1 content-start gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">
              {job.title}
              {job.company && <span className="font-normal text-subtle"> · {job.company}</span>}
            </h2>
            <span className="rounded-full bg-soft px-2.5 py-0.5 text-xs font-medium text-primary">
              {report.market === "vn" ? dict.marketVn : dict.marketIntl}
            </span>
          </div>
          {report.previous && (
            <p className="text-sm">
              {format(dict.previousScore, { before: report.previous.overall, after: ats.overall })}{" "}
              <span className={ats.overall >= report.previous.overall ? "font-semibold text-success" : "font-semibold text-danger"}>
                ({ats.overall >= report.previous.overall ? "+" : ""}
                {ats.overall - report.previous.overall})
              </span>
              {previousHref && (
                <>
                  {" · "}
                  <Link href={previousHref} className="text-primary hover:underline">
                    {dict.viewPrevious}
                  </Link>
                </>
              )}
            </p>
          )}
          <p className="text-sm leading-relaxed">{analysis.verdict}</p>
          <dl className="mt-2 grid gap-2.5">
            {(Object.keys(COMPONENT_WEIGHTS) as AtsComponentKey[]).map((key) => {
              const score = ats.components[key];
              return (
                <div key={key} className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-3 text-sm">
                  <dt className="text-subtle">{dict.breakdown[key]}</dt>
                  <dd className="h-2 overflow-hidden rounded-full bg-line">
                    {score !== null && (
                      <div className={`h-full rounded-full ${TONE_BAR[scoreTone(score)]}`} style={{ width: `${score}%` }} />
                    )}
                  </dd>
                  <dd className="text-right tabular-nums text-subtle">
                    {score === null ? <span title={dict.notApplicable}>–</span> : score}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      <Card title={dict.skillsTitle}>
        <div className="grid gap-4">
          <CoverageRow label={dict.breakdown.required} coverage={ats.coverage.required} dict={dict} />
          <CoverageRow label={dict.breakdown.preferred} coverage={ats.coverage.preferred} dict={dict} />
          <CoverageRow label={dict.breakdown.keywords} coverage={ats.coverage.keywords} dict={dict} />
          <div className="grid gap-1 border-t border-line pt-4 text-sm">
            <h3 className="font-medium">{dict.breakdown.experience}</h3>
            <p className="text-subtle">
              {ats.experience.requiredYears !== null && format(dict.yearsRequired, { years: ats.experience.requiredYears })}
              {ats.experience.requiredYears !== null && " · "}
              {ats.experience.candidateYears !== null
                ? format(dict.yearsCandidate, { years: ats.experience.candidateYears })
                : dict.yearsUnknown}
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {analysis.strengths.length > 0 && (
          <Card title={dict.strengths}>
            <List items={analysis.strengths} />
          </Card>
        )}
        {analysis.gaps.length > 0 && (
          <Card title={dict.gaps}>
            <ul className="grid gap-4 text-sm">
              {analysis.gaps.map((gap) => (
                <li key={gap.requirement} className="grid gap-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[gap.severity]}`}>
                      {dict.severity[gap.severity]}
                    </span>
                    <span className="font-medium">{gap.requirement}</span>
                  </div>
                  {gap.evidence_in_cv && (
                    <p className="text-xs text-subtle">
                      {dict.evidence}: {gap.evidence_in_cv}
                    </p>
                  )}
                  <p className="leading-relaxed">{gap.advice}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {suggestions.length > 0 && (
        <Card
          title={dict.suggestions}
          aside={
            <div className="flex flex-wrap items-center gap-3 text-sm text-subtle">
              <span>{format(dict.acceptedCount, { count: acceptedLines.length, total: suggestions.length })}</span>
              {acceptedLines.length > 0 && (
                <CopyButton text={acceptedText} label={dict.copyAccepted} copiedLabel={dict.copied} />
              )}
            </div>
          }
        >
          <ol className="grid gap-4">
            {suggestions.map((suggestion, index) => (
              <li key={`${suggestion.section}-${suggestion.item_index}-${suggestion.bullet_index}-${index}`}>
                <SuggestionCard
                  suggestion={suggestion}
                  context={suggestionContext(suggestion, resume, dict)}
                  choice={choices.bullets[index] ?? null}
                  onChoose={(choice) => choose({ kind: "bullet", index }, choice)}
                  dict={dict}
                />
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Card title={dict.summaryRewrite}>
        <SuggestionCard
          suggestion={analysis.summary_rewrite}
          choice={choices.summary}
          onChoose={(choice) => choose({ kind: "summary" }, choice)}
          dict={dict}
        />
      </Card>

      <section className="flex flex-col gap-4 rounded-xl border border-primary bg-soft p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="grid gap-1">
          <h2 className="text-lg font-semibold">{dict.exportTitle}</h2>
          <p className="text-sm text-subtle">
            {changeCount > 0 ? format(dict.exportBody, { count: changeCount }) : dict.exportEmpty}
          </p>
        </div>
        <Link
          href={exportHref}
          className="shrink-0 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-fg hover:opacity-90"
        >
          {dict.exportCta}
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {analysis.keywords_to_add.length > 0 && (
          <Card title={dict.keywordsToAdd}>
            <ul className="grid gap-2 text-sm">
              {analysis.keywords_to_add.map((item) => (
                <li key={item.keyword} className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-medium">{item.keyword}</span>
                  <span className="text-subtle">→ {item.where}</span>
                  {item.only_if_true && <span className="text-xs text-warning">({dict.onlyIfTrue})</span>}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {analysis.questions_for_user.length > 0 && (
          <Card title={dict.questions}>
            <List items={analysis.questions_for_user} />
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={dict.formatIssues}>
          {ats.formatIssues.length === 0 ? (
            <p className="text-sm text-subtle">{dict.noFormatIssues}</p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {ats.formatIssues.map((issue) => (
                <li key={issue.code} className="flex gap-2">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${ISSUE_DOT[issue.severity]}`} />
                  <span>{dict.formatIssue[issue.code]}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {analysis.market_notes.length > 0 && (
          <Card title={dict.marketNotes}>
            <List items={analysis.market_notes} />
          </Card>
        )}
      </div>

      <footer className="flex flex-col gap-4 border-t border-line pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1 text-sm text-subtle">
          <p>{dict.disclaimer}</p>
          {process.env.NODE_ENV !== "production" && (
            <p className="text-xs">{format(dict.cost, { cost: `$${report.costUsd.toFixed(4)}` })}</p>
          )}
        </div>
        <Link
          href={newAnalysisHref}
          className="rounded-lg border border-line px-4 py-2 text-center text-sm font-medium hover:bg-soft"
        >
          {dict.newAnalysis}
        </Link>
      </footer>
    </div>
  );
}
