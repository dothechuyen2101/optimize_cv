import type { Dictionary } from "@/i18n/types";
import type { InterviewErrorCode } from "@/lib/interview/types";

/** Interview-specific wording first, then the shared messages for AI and request errors. */
export function interviewErrorText(
  code: InterviewErrorCode,
  dict: Dictionary["interview"],
  errors: Dictionary["analyze"]["errors"],
): string {
  return code in dict.errors ? dict.errors[code as keyof typeof dict.errors] : errors[code as keyof typeof errors];
}
