import type { ReactNode } from "react";
import type { Dictionary } from "@/i18n/types";
import type { RoleReport } from "@/lib/ai/schemas/role";

type RoleDict = Dictionary["role"];

function Card({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {note && <p className="mt-1 text-xs text-subtle">{note}</p>}
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

function Requirements({ items, dict }: { items: RoleReport["must_have"]; dict: RoleDict }) {
  return (
    <ul className="grid gap-3 text-sm">
      {items.map((item, i) => (
        <li key={i}>
          <p className="font-medium">{item.item}</p>
          <p className="mt-0.5 text-xs text-subtle">
            {dict.evidence}: {item.evidence_in_jd}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function RoleReportView({ report, dict }: { report: RoleReport; dict: RoleDict }) {
  return (
    <div className="grid gap-6">
      <Card title={dict.summary}>
        <p className="text-sm leading-relaxed">{report.summary}</p>
        <p className="mt-3 text-sm">
          <span className="rounded-full bg-soft px-2.5 py-0.5 text-xs font-medium text-primary">
            {dict.seniority}: {report.seniority.level}
          </span>
        </p>
        {report.seniority.signals.length > 0 && (
          <div className="mt-3">
            <Bullets items={report.seniority.signals} />
          </div>
        )}
      </Card>

      <Card title={dict.responsibilities}>
        <dl className="grid gap-3 text-sm">
          {report.responsibilities.map((item, i) => (
            <div key={i}>
              <dt className="font-medium">{item.area}</dt>
              <dd className="mt-0.5 leading-relaxed text-subtle">{item.detail}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={dict.mustHave}>
          <Requirements items={report.must_have} dict={dict} />
        </Card>
        {report.nice_to_have.length > 0 && (
          <Card title={dict.niceToHave}>
            <Requirements items={report.nice_to_have} dict={dict} />
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={dict.yourAngle}>
          <div className="grid gap-4 text-sm">
            <div>
              <h3 className="mb-2 font-medium text-success">{dict.strengths}</h3>
              <Bullets items={report.your_angle.strengths_to_highlight} />
            </div>
            {report.your_angle.gaps_to_prepare.length > 0 && (
              <div>
                <h3 className="mb-2 font-medium text-warning">{dict.gapsToPrepare}</h3>
                <Bullets items={report.your_angle.gaps_to_prepare} />
              </div>
            )}
          </div>
        </Card>
        {report.unknowns.length > 0 && (
          <Card title={dict.unknowns}>
            <Bullets items={report.unknowns} />
          </Card>
        )}
      </div>

      <Card title={dict.rounds} note={dict.roundsNote}>
        <ol className="grid gap-4 text-sm">
          {report.interview_rounds.map((round, i) => (
            <li key={i} className="grid grid-cols-[2rem_1fr] gap-2">
              <span className="flex size-7 items-center justify-center rounded-full bg-soft text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <div>
                <p className="font-medium">{round.name}</p>
                <p className="mt-0.5 text-subtle">{round.focus}</p>
                <p className="mt-1 leading-relaxed">{round.how_to_prepare}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card title={dict.practice}>
        <ol className="grid gap-3">
          {report.practice_questions.map((item, i) => (
            <li key={i} className="rounded-lg border border-line p-4 text-sm">
              <div className="flex flex-wrap items-start gap-2">
                <span className="rounded-full bg-soft px-2 py-0.5 text-xs font-medium text-primary">
                  {dict.category[item.category]}
                </span>
                <p className="flex-1 font-medium">{item.question}</p>
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-medium text-primary">{dict.answerTips}</summary>
                <p className="mt-2 text-xs text-subtle">
                  {dict.whyAsked}: {item.why_asked}
                </p>
                <p className="mt-1 leading-relaxed">{item.answer_tips}</p>
              </details>
            </li>
          ))}
        </ol>
      </Card>

      <Card title={dict.questionsToAsk}>
        <Bullets items={report.questions_to_ask} />
      </Card>
    </div>
  );
}
