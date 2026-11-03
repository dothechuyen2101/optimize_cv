import type { AnalysisErrorCode } from "@/lib/analysis/types";

export const MAX_ANSWER_CHARS = 4000;
/** Hard stop on a session's length, whatever the model does; about 20 exchanges. */
export const MAX_TURNS = 40;

export type InterviewErrorCode = AnalysisErrorCode | "interview_over" | "answer_empty" | "answer_too_long" | "no_answers";
