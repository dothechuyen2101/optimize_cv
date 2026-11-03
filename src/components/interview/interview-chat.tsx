"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { format, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import type { AnswerFeedback, InterviewReport } from "@/lib/ai/schemas/interview";
import type { StoredTurn } from "@/lib/interview/service";
import { MAX_ANSWER_CHARS, type InterviewErrorCode } from "@/lib/interview/types";
import { interviewErrorText } from "./error-text";
import { InterviewReportView } from "./interview-report-view";
import { withSpokenText } from "./speech-text";
import { useSpeechInput, useSpeechOutput } from "./use-voice";

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

function Turn({ turn, dict, onReplay }: { turn: StoredTurn; dict: InterviewDict; onReplay?: () => void }) {
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
      {onReplay && (
        <button type="button" onClick={onReplay} className="mt-1 text-xs text-subtle hover:text-foreground">
          🔊 {dict.voice.replay}
        </button>
      )}
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
  /** The interview's language, for reading questions aloud and transcribing answers. */
  language: Locale;
  /** Whether spoken answers are available (the speech-to-text key is configured). */
  voiceInput: boolean;
  initialTurns: StoredTurn[];
  initialReport: InterviewReport | null;
  newSessionHref: string;
  dict: InterviewDict;
  errors: Dictionary["analyze"]["errors"];
}

/** The practice interview: answer in chat, then get the session scored. */
export function InterviewChat({
  sessionId,
  language,
  voiceInput,
  initialTurns,
  initialReport,
  newSessionHref,
  dict,
  errors,
}: Props) {
  const [turns, setTurns] = useState(initialTurns);
  const [report, setReport] = useState(initialReport);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<"answer" | "finish" | null>(null);
  const [error, setError] = useState<InterviewErrorCode | null>(null);
  const [readAloud, setReadAloud] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  // What was typed before speaking; the transcript is appended to it.
  const typedBeforeSpeaking = useRef("");
  const voice = useSpeechOutput(language);
  const mic = useSpeechInput(sessionId, (spoken) => setDraft(withSpokenText(typedBeforeSpeaking.current, spoken)));
  const listening = mic.state !== "idle";

  const last = turns.at(-1);
  const closed = report !== null || last?.kind === "closing";
  const answered = turns.some((turn) => turn.role === "candidate");

  // Read the opening question once a voice is ready (voices load asynchronously).
  const openingRead = useRef(false);
  useEffect(() => {
    if (openingRead.current || !voice.available || !readAloud || closed || turns.length !== 1) return;
    openingRead.current = true;
    voice.speak(turns[0].content);
  }, [voice, readAloud, closed, turns]);

  function startSpeaking() {
    voice.stop();
    typedBeforeSpeaking.current = draft;
    mic.start();
  }

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
    const reply = data.turns.at(-1);
    if (readAloud && reply?.role === "interviewer") voice.speak(reply.content);
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
            <Turn
              key={turn.position}
              turn={turn}
              dict={dict}
              onReplay={turn.role === "interviewer" && voice.available ? () => voice.speak(turn.content) : undefined}
            />
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
        {mic.error && (
          <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
            {mic.error === "mic_denied" ? dict.voice.micDenied : interviewErrorText(mic.error, dict, errors)}
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-subtle">
            {voice.available ? (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={readAloud}
                  onChange={(event) => {
                    setReadAloud(event.target.checked);
                    if (!event.target.checked) voice.stop();
                  }}
                  className="size-4 accent-[var(--primary)]"
                />
                {dict.voice.readAloud}
              </label>
            ) : (
              <span>{format(dict.voice.noVoice, { language: dict.languages[language] })}</span>
            )}
            {voiceInput && mic.supported && <span>{dict.voice.privacy}</span>}
          </div>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
            disabled={pending !== null || listening}
            maxLength={MAX_ANSWER_CHARS}
            rows={5}
            placeholder={dict.placeholder}
            aria-label={dict.placeholder}
            className="resize-y rounded-xl border border-line bg-card p-4 text-sm leading-relaxed"
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={pending !== null || listening || !draft.trim()}
              className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:opacity-50"
            >
              {dict.send}
            </button>
            {voiceInput && mic.supported && (
              <button
                type="button"
                onClick={mic.state === "listening" ? mic.stop : startSpeaking}
                disabled={pending !== null || mic.state === "connecting" || mic.state === "stopping"}
                aria-pressed={mic.state === "listening"}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${
                  mic.state === "listening" ? "bg-danger text-white hover:opacity-90" : "border border-line bg-card hover:bg-soft"
                }`}
              >
                {mic.state === "listening"
                  ? `■ ${dict.voice.stop}`
                  : mic.state === "connecting"
                    ? dict.voice.connecting
                    : mic.state === "stopping"
                      ? dict.voice.finishing
                      : `🎙 ${dict.voice.speak}`}
              </button>
            )}
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
            <span className="text-xs text-subtle" aria-live="polite">
              {mic.state === "listening" ? dict.voice.listening : dict.inputHint}
            </span>
          </div>
        </form>
      )}
    </div>
  );
}
