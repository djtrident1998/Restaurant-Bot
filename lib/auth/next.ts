// Where to send a customer after signing in or creating an account: back to the page they came from (the table finder or
// the dining order page) instead of the generic start. Only same-site /book and /order paths are accepted, so this can
// never be used as an open redirect.
const SAFE_NEXT = /^\/(book|order)(\?[\w=&%.:-]{0,200})?$/;

export function safeNext(raw: unknown): string | undefined {
  return typeof raw === "string" && SAFE_NEXT.test(raw) ? raw : undefined;
}

/** "/login" or "/login?next=/book%3Fdate%3D…" */
export function withNext(path: string, next: string | undefined): string {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
