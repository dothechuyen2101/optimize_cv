// Shared by the auth Server Actions and the forms that call them ("use server"
// files may only export async functions).

export type AuthErrorCode =
  | "invalid_input"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "weak_password"
  | "same_password"
  | "rate_limited"
  | "email_send_failed"
  | "unknown";

export type AuthFormState =
  | { error: AuthErrorCode }
  | { notice: "check_email" | "reset_sent"; email: string }
  | null;

export const MIN_PASSWORD_LENGTH = 8;
