// Runs the booking-words extraction on the configured model chain: free models first, the paid one only if the shared daily
// budget allows (the same rule as the chat). Short time limits, no retries: if nothing answers, the chat simply carries on with
// the instant reader's result and asks the customer for what is missing.
import { generateObject } from "ai";
import { getLimits } from "./config";
import { availableCandidates, buildModel, cooldownFor, getChain, isPaid, markFailed } from "./models";
import { takeDaily } from "./budget";
import { extractSchema } from "./bookingAi";

const ATTEMPT_MS = 8_000;
const MAX_ATTEMPTS = 2;

export async function extractWithChain(prompt: { system: string; prompt: string }): Promise<unknown | null> {
  let candidates;
  try {
    candidates = availableCandidates(getChain());
  } catch {
    return null; // no model configured
  }
  let tried = 0;
  for (const c of candidates) {
    if (tried >= MAX_ATTEMPTS) break;
    if (isPaid(c) && !(await takeDaily("paid", getLimits().paidPerDay))) continue;
    tried++;
    try {
      const r = await generateObject({ model: buildModel(c), schema: extractSchema, system: prompt.system, prompt: prompt.prompt, maxRetries: 0, abortSignal: AbortSignal.timeout(ATTEMPT_MS) });
      return r.object;
    } catch (e) {
      markFailed(c, Date.now(), cooldownFor(String(e)));
      console.warn(`[booking-ai] ${c.provider}:${c.id} failed:`, String(e).slice(0, 200));
    }
  }
  return null;
}
