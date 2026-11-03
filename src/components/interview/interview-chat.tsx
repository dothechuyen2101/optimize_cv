"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { format } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import type { AnswerFeedback, InterviewReport } from "@/lib/ai/schemas/interview";
import type { StoredTurn } from "@/lib/interview/service";
import { MAX_ANSWER_CHARS, type InterviewErrorCode } from "@/lib/interview/types";
import { interviewErrorText } from "./error-text";
import { InterviewReportView } from "./interview-report-view";

type InterviewDict = Dictionary["interview"];

function Feedback({ feedback, dict }: { feedback: AnswerFeedback; dict: InterviewDict }) {
  return (
    <div className="mt-2 grid gap-2 rounded-lg border border-line bg-card p-3 text-sm">
      <p className="flex items-center justify-between gap-2 font-medium">
        {dict.feedbackTitle}
        <span className="rounded-full bg-soft px-2 py-0.5 text-xs font-semibold tabular-nums text-primary">
          {format(dict.score, { score: feedback.score })}
        </span>
      </p>
      {feedback.strengths.length > 0 && (
        <p>
          <span className="font-medium text-success">{dict.good}: </span>
          {feedback.strengths.join(" · ")}
        </p>
      )}
      {feedback.improvements.length > 0 && (
        <p>
          <span className="font-medium text-warning">{dict.improve}: </span>
          {feedback.improvements.join(" · ")}
        </p>
      )}
      {feedback.better_answer_outline && (
        <p className="text-subtle">
          <span className="font-medium text-foreground">{dict.betterAnswer}: </span>
          {feedback.better_answer_outline}
        </p>
      )}
    </div>
  );
}

function Turn({ turn, dict }: { turn: StoredTurn; dict: InterviewDict }) {
  const candidate = turn.role === "candidate";
  return (
    <li className={`flex flex-col ${candidate ? "items-end" : "items-start"}`}>
      <span className="mb-1 text-xs text-subtle">{candidate ? dict.you : dict.interviewer}</span>
      <div
        className={`max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          candidate ? "rounded-br-sm bg-primary text-primary-fg" : "rounded-bl-sm border border-line bg-card"
        }`}
      >
        {turn.content}
      </div>
      {candidate && turn.feedback && (
        <div className="w-full max-w-[85%]">
          <Feedback feedback={turn.feedback} dict={dict} />
        </div>
      )}
    </li>
  );
}

interface Props {
  sessionId: string;
  initialTurns: StoredTurn[];
  initialReport: InterviewReport | null;
  newSessionHref: string;
  dict: InterviewDict;
  errors: Dictionary["analyze"]["errors"];
}

/** The practice interview: answer in chat, then get the session scored. */
export function InterviewChat({ sessionId, initialTurns, initialReport, newSessionHref, dict, errors }: Props) {
  const [turns, setTurns] = useState(initialTurns);
  const [report, setReport] = useState(initialReport);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<"answer" | "finish" | null>(null);
  const [error, setError] = useState<InterviewErrorCode | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const last = turns.at(-1);
  const closed = report !== null || last?.kind === "closing";
  const answered = turns.some((turn) => turn.role === "candidate");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, pending]);

  async function post<T>(path: string, body?: unknown): Promise<T | null> {
    try {
      const response = await fetch(`/api/interviews/${sessionId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as (T & { code?: InterviewErrorCode }) | null;
      if (response.ok && data) return data;
      setError(data?.code ?? "server");
    } catch {
      setError("server");
    }
    return null;
  }

  async function finish() {
    setPending("finish");
    setError(null);
    const data = await post<{ report: InterviewReport }>("finish");
    if (data) setReport(data.report);
    setPending(null);
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const answer = draft.trim();
    if (!answer || pending) return;
    setPending("answer");
    setError(null);
    const data = await post<{ turns: StoredTurn[] }>("answer", { answer });
    setPending(null);
    if (!data) return;
    setTurns((current) => [...current, ...data.turns]);
    setDraft("");
    // The interviewer wrapped up: score the session right away.
    if (data.turns.at(-1)?.kind === "closing") await finish();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) send();
  }

  return (
    <div className="grid gap-6">
      {report && <InterviewReportView report={report} dict={dict} />}

      <section className="grid gap-4">
        {report && <h2 className="text-lg font-semibold">{dict.transcript}</h2>}
        <ol className="grid gap-4">
          {turns.map((turn) => (
            <Turn key={turn.position} turn={turn} dict={dict} />
          ))}
        </ol>
        {pending && (
          <p className="text-sm text-subtle" aria-live="polite">
            {pending === "answer" ? dict.thinking : dict.finishing}
          </p>
        )}
        {error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
            {interviewErrorText(error, dict, errors)}
          </p>
        )}
        <div ref={endRef} />
      </section>

      {report ? (
        <Link
          href={newSessionHref}
          className="justify-self-start rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium hover:bg-soft"
        >
          {dict.again}
        </Link>
      ) : closed ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-subtle">{dict.closed}</p>
          {pending !== "finish" && (
            <button
              type="button"
              onClick={finish}
              className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90"
            >
              {dict.finish}
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={send} className="grid gap-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={pending !== null}
            maxLength={MAX_ANSWER_CHARS}
            rows={5}
            placeholder={dict.placeholder}
            aria-label={dict.placeholder}
            className="resize-y rounded-xl border border-line bg-card p-4 text-sm leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending !== null || !draft.trim()}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
            >
              {dict.send}
            </button>
            {answered && (
              <button
                type="button"
                onClick={finish}
                disabled={pending !== null}
                className="rounded-lg border border-line bg-card px-4 py-2.5 text-sm font-medium hover:bg-soft disabled:opacity-50"
              >
                {dict.finish}
              </button>
            )}
            <span className="text-xs text-subtle">{dict.inputHint}</span>
          </div>
        </form>
      )}
    </div>
  );
}
