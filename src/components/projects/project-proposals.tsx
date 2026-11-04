"use client";

import Link from "next/link";
import { startTransition, useState } from "react";
import { WithPlaceholders } from "@/components/analyze/with-placeholders";
import { format } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { findPlaceholders, type Decision } from "@/lib/analysis/types";
import { saveProjectDecisions } from "@/lib/projects/actions";
import type { ProjectDecisions, ProjectImportResult, ProjectProposal } from "@/lib/projects/types";

interface Props {
  analysisId: string;
  result: ProjectImportResult;
  initialDecisions: ProjectDecisions;
  cvHref: string;
  dict: Dictionary["projects"];
}

function Chips({ label, items, tone }: { label: string; items: string[]; tone: "success" | "soft" }) {
  if (items.length === 0) return null;
  const chip = tone === "success" ? "bg-success-soft text-success" : "bg-soft";
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="text-subtle">{label}:</span>
      {items.map((item) => (
        <span key={item} className={`rounded-full px-2 py-0.5 ${chip}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

function ProposalCard({
  proposal,
  decision,
  onDecide,
  dict,
}: {
  proposal: ProjectProposal;
  decision: Decision | undefined;
  onDecide: (decision: Decision | null) => void;
  dict: Dictionary["projects"];
}) {
  const border =
    decision === "accepted" ? "border-success" : decision === "rejected" ? "border-line opacity-60" : "border-line";
  const hasGaps = proposal.bullets.some((bullet) => findPlaceholders(bullet).length > 0);
  const button = "rounded-md px-3 py-1.5 text-xs font-medium";

  return (
    <article className={`grid gap-3 rounded-xl border bg-card p-5 ${border}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{proposal.name}</h2>
        <a href={proposal.url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
          {dict.viewRepo} ↗
        </a>
      </header>
      {proposal.description && <p className="text-sm leading-relaxed">{proposal.description}</p>}
      <Chips label={dict.technologies} items={proposal.technologies} tone="soft" />
      <ul className="grid gap-1.5 rounded-lg bg-soft px-4 py-3 text-sm leading-relaxed">
        {proposal.bullets.map((bullet) => (
          <li key={bullet} className="ml-4 list-disc">
            <WithPlaceholders text={bullet} />
          </li>
        ))}
      </ul>
      <div className="grid gap-1 text-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-subtle">{dict.reason}</p>
        <p className="leading-relaxed">{proposal.reason}</p>
      </div>
      <Chips label={dict.matched} items={proposal.matched_requirements} tone="soft" />
      <Chips label={dict.newSkills} items={proposal.new_skills} tone="success" />
      {decision === "accepted" && hasGaps && (
        <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">{dict.placeholders}</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {decision ? (
          <>
            <span className={`text-sm font-medium ${decision === "accepted" ? "text-success" : "text-subtle"}`}>
              {decision === "accepted" ? dict.accepted : dict.rejected}
            </span>
            <button type="button" onClick={() => onDecide(null)} className={`${button} text-subtle hover:bg-soft`}>
              {dict.undo}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onDecide("accepted")}
              className={`${button} bg-primary font-semibold text-primary-fg hover:opacity-90`}
            >
              {dict.accept}
            </button>
            <button
              type="button"
              onClick={() => onDecide("rejected")}
              className={`${button} border border-line text-subtle hover:bg-soft`}
            >
              {dict.reject}
            </button>
          </>
        )}
      </div>
    </article>
  );
}

/** The proposed projects; each accept or skip is saved as the user makes it. */
export function ProjectProposals({ analysisId, result, initialDecisions, cvHref, dict }: Props) {
  const [decisions, setDecisions] = useState<ProjectDecisions>(initialDecisions);
  const { proposals } = result;
  const accepted = proposals.filter((_, index) => decisions[index] === "accepted").length;
  const undecided = proposals.map((_, index) => index).filter((index) => !decisions[index]);

  function decide(changes: Record<number, Decision | null>) {
    setDecisions((current) => {
      const next = { ...current };
      for (const [index, decision] of Object.entries(changes)) {
        if (decision) next[index] = decision;
        else delete next[index];
      }
      return next;
    });
    startTransition(() => saveProjectDecisions(analysisId, changes));
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          {proposals.length > 0 ? format(dict.progress, { accepted, total: proposals.length }) : dict.none}
        </p>
        <div className="flex flex-wrap gap-2">
          {undecided.length > 1 && (
            <button
              type="button"
              onClick={() => decide(Object.fromEntries(undecided.map((index) => [index, "accepted"])))}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium hover:bg-soft"
            >
              {dict.acceptAll}
            </button>
          )}
          {proposals.length > 0 && (
            <Link
              href={cvHref}
              className="rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-primary-fg hover:opacity-90"
            >
              {dict.cvCta} →
            </Link>
          )}
        </div>
      </div>

      {proposals.map((proposal, index) => (
        <ProposalCard
          key={proposal.repo}
          proposal={proposal}
          decision={decisions[index]}
          onDecide={(decision) => decide({ [index]: decision })}
          dict={dict}
        />
      ))}

      {result.skipped.length > 0 && (
        <details open={proposals.length === 0} className="rounded-xl border border-line bg-card px-5 py-4 text-sm">
          <summary className="cursor-pointer font-medium">{format(dict.skipped, { count: result.skipped.length })}</summary>
          <ul className="mt-3 grid gap-2">
            {result.skipped.map((item) => (
              <li key={item.repo}>
                <span className="font-medium">{item.repo}</span>
                <span className="text-subtle"> · {item.reason}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
