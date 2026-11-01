import type { Candidate } from "./models";

// Chunks that mean the model has actually started answering. Before the first one we can still switch
// providers invisibly; after it we are committed (a tool may already have run, so we never retry then).
const COMMIT = new Set(["text-start", "text-delta", "reasoning-start", "reasoning-delta", "tool-input-start", "tool-input-available"]);

export const ALL_FAILED_MESSAGE = "The AI service is busy right now. Please try again in a minute.";

interface Chunk {
  type: string;
  errorText?: string;
}

/**
 * Tries each candidate in order. An attempt that errors (stream error chunk or thrown) BEFORE producing
 * any answer content is discarded and the next candidate is tried. Returns the candidate that answered,
 * or null if all failed (an error chunk is written).
 */
export async function streamWithFailover<C extends Chunk>(
  candidates: Candidate[],
  attempt: (c: Candidate, isLast: boolean) => AsyncIterable<C>,
  write: (chunk: C | { type: "error"; errorText: string }) => void,
  onFail?: (c: Candidate, error: unknown) => void,
): Promise<Candidate | null> {
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const buffer: C[] = [];
    let committed = false;
    let failure: unknown = null;
    try {
      for await (const chunk of attempt(c, i === candidates.length - 1)) {
        if (committed) {
          write(chunk);
        } else if (chunk.type === "error") {
          failure = chunk.errorText ?? "provider error";
          break;
        } else {
          buffer.push(chunk);
          if (COMMIT.has(chunk.type)) {
            committed = true;
            buffer.splice(0).forEach(write);
          }
        }
      }
    } catch (e) {
      if (committed) throw e;
      failure = e;
    }
    if (committed) return c;
    if (failure === null) {
      buffer.forEach(write); // finished cleanly without content (unusual); pass it through
      return c;
    }
    onFail?.(c, failure);
  }
  write({ type: "error", errorText: ALL_FAILED_MESSAGE });
  return null;
}
