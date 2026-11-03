import "server-only";
import type { Locale } from "@/i18n/config";
import { INTERVIEW_REPORT_PROMPT, INTERVIEW_TURN_PROMPT } from "../prompts/interview";
import { runStructuredStep } from "../run-step";
import {
  InterviewReportSchema,
  InterviewTurnSchema,
  type InterviewDifficulty,
  type InterviewType,
} from "../schemas/interview";
import type { Job } from "../schemas/job";
import type { Resume } from "../schemas/resume";

export interface InterviewSettings {
  type: InterviewType;
  difficulty: InterviewDifficulty;
  language: Locale;
  feedback: boolean;
}

export interface TranscriptEntry {
  role: "interviewer" | "candidate";
  kind?: "question" | "follow_up" | "closing";
  content: string;
}

export interface InterviewContext {
  job: Job;
  resume: Resume;
  settings: InterviewSettings;
  transcript: TranscriptEntry[];
}

/** Main questions per session; with follow-ups a session runs about 10-15 exchanges. */
export const MAIN_QUESTIONS = 6;

function system(prompt: string, { job, resume }: InterviewContext): string {
  return `${prompt}\n\n<context>\n${JSON.stringify({ job, resume })}\n</context>`;
}

export function nextInterviewTurn(context: InterviewContext) {
  const payload = { settings: { ...context.settings, main_questions: MAIN_QUESTIONS }, transcript: context.transcript };
  return runStructuredStep({
    step: "interview_turn",
    system: system(INTERVIEW_TURN_PROMPT.system, context),
    content: [{ type: "text", text: JSON.stringify(payload) }],
    schema: InterviewTurnSchema,
  });
}

export function scoreInterview(context: InterviewContext) {
  const { type, difficulty, language } = context.settings;
  const payload = { settings: { type, difficulty, language }, transcript: context.transcript };
  return runStructuredStep({
    step: "interview_report",
    system: system(INTERVIEW_REPORT_PROMPT.system, context),
    content: [{ type: "text", text: JSON.stringify(payload) }],
    schema: InterviewReportSchema,
  });
}
