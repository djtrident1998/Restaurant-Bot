import type { Candidate } from "./models";

export const ALL_FAILED_MESSAGE = "The AI service is busy right now. Please try again in a minute.";

interface Chunk {
  type: string;
  errorText?: string;
}

export interface FailoverHooks {
  /** Called before EVERY attempt (including the first) — use it to roll back side effects of a failed attempt. */
  beforeAttempt?: (c: Candidate) => void;
  onFail?: (c: Candidate, error: unknown) => void;
}

/**
 * Tries each candidate in order. Each attempt is run to completion and buffered; nothing reaches the
 * client unless the attempt finishes without an error. If a model fails at ANY point (rate limit, no
 * credits, outage — including mid-way through a multi-step tool turn), its output is discarded,
 * `beforeAttempt` rolls back its side effects, and the next candidate runs the whole turn again.
 * Trade-off: the reply arrives at once instead of streaming word by word.
 * Returns the candidate that answered, or null if all failed (an error chunk is written).
 */
export async function streamWithFailover<C extends Chunk>(
  candidates: Candidate[],
  attempt: (c: Candidate, isLast: boolean) => AsyncIterable<C>,
  write: (chunk: C | { type: "error"; errorText: string }) => void,
  hooks: FailoverHooks = {},
): Promise<Candidate | null> {
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    hooks.beforeAttempt?.(c);
    const buffer: C[] = [];
    let failure: unknown = null;
    try {
      for await (const chunk of attempt(c, i === candidates.length - 1)) {
        if (chunk.type === "error" || chunk.type === "abort") {
          // "abort" = the per-attempt time limit fired; treat a stuck model like a failed one.
          failure = chunk.errorText ?? (chunk.type === "abort" ? "attempt timed out" : "provider error");
          break;
        }
        buffer.push(chunk);
      }
    } catch (e) {
      failure = e;
    }
    if (failure === null) {
      buffer.forEach(write);
      return c;
    }
    hooks.onFail?.(c, failure);
  }
  hooks.beforeAttempt?.(candidates[candidates.length - 1]); // leave state as it was before the turn
  write({ type: "error", errorText: ALL_FAILED_MESSAGE });
  return null;
}
