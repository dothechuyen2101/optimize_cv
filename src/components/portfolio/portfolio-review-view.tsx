import type { ReactNode } from "react";
import { ScoreRing } from "@/components/analyze/score-ring";
import type { Dictionary } from "@/i18n/types";
import type { PortfolioReview } from "@/lib/ai/schemas/portfolio";

type PortfolioDict = Dictionary["portfolio"];
const RUBRIC_KEYS = ["relevance", "depth", "presentation", "credibility", "completeness"] as const;
const PRIORITY_STYLE = {
  high: "bg-danger-soft text-danger",
  medium: "bg-warning-soft text-warning",
  low: "bg-soft text-subtle",
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-2 text-sm leading-relaxed">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PortfolioReviewView({ review, dict }: { review: PortfolioReview; dict: PortfolioDict }) {
  return (
    <div className="grid gap-6">
      <section className="flex flex-col gap-6 rounded-xl border border-line bg-card p-5 sm:flex-row sm:p-6">
        <ScoreRing score={review.overall} label={dict.overall} />
        <div className="grid flex-1 content-start gap-3">
          <p className="text-sm leading-relaxed">{review.verdict}</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            {RUBRIC_KEYS.map((key) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-soft px-3 py-2 text-sm">
                <dt className="text-subtle">{dict.rubric[key]}</dt>
                <dd className="font-semibold tabular-nums">{review.rubric[key]}/5</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Card title={dict.improvements}>
        <ol className="grid gap-3">
          {review.improvements.map((item, i) => (
            <li key={i} className="rounded-lg border border-line p-4 text-sm">
              <div className="flex flex-wrap items-start gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[item.priority]}`}>
                  {dict.priority[item.priority]}
                </span>
                <p className="flex-1 font-medium">{item.action}</p>
              </div>
              <p className="mt-2 text-subtle">
                {dict.why}: {item.why}
              </p>
              <p className="mt-1 text-subtle">
                {dict.where}: {item.where}
              </p>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {review.strengths.length > 0 && (
          <Card title={dict.strengths}>
            <Bullets items={review.strengths} />
          </Card>
        )}
        {review.featured_picks.length > 0 && (
          <Card title={dict.featured}>
            <ul className="grid gap-3 text-sm">
              {review.featured_picks.map((pick, i) => (
                <li key={i}>
                  <p className="font-medium">{pick.item}</p>
                  <p className="mt-0.5 leading-relaxed text-subtle">{pick.reason}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      {review.missing_for_role.length > 0 && (
        <Card title={dict.missing}>
          <Bullets items={review.missing_for_role} />
        </Card>
      )}

      <Card title={dict.sources}>
        <ul className="grid gap-4 text-sm">
          {review.sources.map((source, i) => (
            <li key={i} className="grid gap-1.5">
              <p className="break-all font-medium">{source.source}</p>
              <p className="leading-relaxed text-subtle">{source.summary}</p>
              {source.issues.length > 0 && <Bullets items={source.issues} />}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
