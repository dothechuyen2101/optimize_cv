/**
 * Accepts only same-origin paths as a post-auth destination, so `?next=` can't
 * send users to another site.
 */
export function safeNextPath(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  // "//evil.com" is protocol-relative, browsers treat "\" like "/", and they strip
  // tabs/newlines, so "/\t/evil.com" becomes "//evil.com".
  if (value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
