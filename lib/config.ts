// Cost / abuse limits, tunable WITHOUT a code change: set these env vars in Vercel (all optional) and redeploy.
// Defaults are conservative for a public demo that may be shared widely (e.g. on LinkedIn).

const int = (v: string | undefined, d: number, min = 0, max = 1_000_000) => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
};

export interface Limits {
  /** AI chat messages per visitor (IP) per minute / per day. Button-driven actions (menu, cart, order) are free and not counted. */
  perMinute: number;
  perDay: number;
  /** AI chat messages for the whole demo per day (per server instance; see paidPerDay for the shared hard cap). */
  globalPerDay: number;
  /** HARD, shared daily cap on calls to the PAID model (Claude Haiku). Free models are tried first and don't use this. */
  paidPerDay: number;
  /** Longest message accepted (typed or spoken). Short questions only; long text is how token costs balloon. */
  maxInputChars: number;
  /** Per-message and total history sent to the AI (characters). */
  maxHistoryMsgChars: number;
  maxHistoryTotalChars: number;
  /** Largest request body accepted by the chat API. */
  maxBodyBytes: number;
}

export function getLimits(env: NodeJS.ProcessEnv = process.env): Limits {
  return {
    perMinute: int(env.LIMIT_PER_MINUTE, 10, 1, 120),
    perDay: int(env.LIMIT_PER_DAY, 40, 1, 5000),
    globalPerDay: int(env.LIMIT_GLOBAL_PER_DAY, 300, 1, 1_000_000),
    paidPerDay: int(env.LIMIT_PAID_PER_DAY, 60, 0, 1_000_000),
    maxInputChars: int(env.LIMIT_INPUT_CHARS, 400, 50, 4000),
    maxHistoryMsgChars: int(env.LIMIT_HISTORY_MSG_CHARS, 800, 100, 4000),
    maxHistoryTotalChars: int(env.LIMIT_HISTORY_TOTAL_CHARS, 10_000, 500, 40_000),
    maxBodyBytes: int(env.LIMIT_BODY_BYTES, 400_000, 10_000, 5_000_000),
  };
}
