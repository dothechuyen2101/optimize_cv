import { ScoreRing } from "@/components/analyze/score-ring";
import type { Dictionary } from "@/i18n/types";
import type { InterviewReport } from "@/lib/ai/schemas/interview";

type InterviewDict = Dictionary["interview"];
const RUBRIC_KEYS = ["structure", "relevance", "evidence", "communication"] as const;

export function InterviewReportView({ report, dict }: { report: InterviewReport; dict: InterviewDict }) {
  return (
    <section className="grid gap-6 rounded-xl border border-line bg-card p-5 sm:p-6">
      <h2 className="text-lg font-semibold">{dict.reportTitle}</h2>
      <div className="flex flex-col gap-6 sm:flex-row">
        <ScoreRing score={report.overall} label={dict.overall} />
        <div className="grid flex-1 content-start gap-3">
          <p className="text-sm leading-relaxed">{report.verdict}</p>
          <dl className="grid gap-2 sm:grid-cols-2">
            {RUBRIC_KEYS.map((key) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-lg bg-soft px-3 py-2 text-sm">
                <dt className="text-subtle">{dict.rubric[key]}</dt>
                <dd className="font-semibold tabular-nums">{report.rubric[key]}/5</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {report.top_improvements.length > 0 && (
        <div>
          <h3 className="mb-2 font-medium">{dict.topImprovements}</h3>
          <ol className="grid list-decimal gap-1.5 pl-5 text-sm leading-relaxed">
            {report.top_improvements.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        </div>
      )}

      {report.per_question.length > 0 && (
        <div>
          <h3 className="mb-2 font-medium">{dict.perQuestion}</h3>
          <ul className="grid gap-3 text-sm">
            {report.per_question.map((item, i) => (
              <li key={i} className="rounded-lg border border-line p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{item.question}</p>
                  <span className="shrink-0 rounded-full bg-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
                    {item.score}/5
                  </span>
                </div>
                <p className="mt-1 leading-relaxed text-subtle">{item.comment}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {report.strongest_moment && (
        <div>
          <h3 className="mb-2 font-medium text-success">{dict.strongest}</h3>
          <p className="text-sm leading-relaxed">{report.strongest_moment}</p>
        </div>
      )}

      {report.improved_answer && (
        <div>
          <h3 className="mb-2 font-medium">{dict.improvedAnswer}</h3>
          <p className="text-sm font-medium">{report.improved_answer.question}</p>
          <p className="mt-2 whitespace-pre-line rounded-lg bg-soft px-3 py-2 text-sm leading-relaxed">
            {report.improved_answer.answer}
          </p>
        </div>
      )}
    </section>
  );
}
