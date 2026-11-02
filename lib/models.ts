import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { groq } from "@ai-sdk/groq";

export type ProviderName = "anthropic" | "groq" | "google";
export interface Candidate {
  provider: ProviderName;
  id: string;
}

const KEY_ENV: Record<ProviderName, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  groq: "GROQ_API_KEY",
  google: "GOOGLE_GENERATIVE_AI_API_KEY",
};

const isProvider = (s: string): s is ProviderName => s in KEY_ENV;

/** "anthropic:claude-haiku-5-5,groq:openai/gpt-oss-120b,google:gemini-2.5-flash" -> ordered candidates. */
export function parseChain(spec: string): Candidate[] {
  return spec
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const i = s.indexOf(":");
      const provider = s.slice(0, i);
      const id = s.slice(i + 1);
      if (i < 1 || !id || !isProvider(provider)) throw new Error(`Bad MODEL_CHAIN entry: "${s}" (expected provider:model-id)`);
      return { provider, id };
    });
}

/** MODEL_CHAIN (ordered primary + backups) if set, otherwise the single MODEL_PROVIDER / MODEL_ID. */
export function getChain(env: NodeJS.ProcessEnv = process.env): Candidate[] {
  if (env.MODEL_CHAIN) return parseChain(env.MODEL_CHAIN);
  const id = env.MODEL_ID;
  if (!id) throw new Error("Set MODEL_CHAIN, or MODEL_PROVIDER + MODEL_ID");
  const p = env.MODEL_PROVIDER ?? "groq";
  if (!isProvider(p)) throw new Error(`Unknown MODEL_PROVIDER "${p}"`);
  return [{ provider: p, id }];
}

/** Only Anthropic (Claude) costs money here; Groq and Gemini are used on their free tiers. */
export const isPaid = (c: Candidate) => c.provider === "anthropic";

export function buildModel(c: Candidate) {
  switch (c.provider) {
    case "anthropic":
      return anthropic(c.id);
    case "google":
      return google(c.id);
    case "groq":
      return groq(c.id);
  }
}

// ---- health: a provider that just failed (rate limit, no credits, outage) is skipped for a while ----

const g = globalThis as unknown as { __spiceCooldown?: Map<string, number> };
const cooldown = (g.__spiceCooldown ??= new Map<string, number>());
export const COOLDOWN_MS = 2 * 60_000;

const keyOf = (c: Candidate) => `${c.provider}:${c.id}`;

export const DAILY_COOLDOWN_MS = 10 * 60_000;

/** Daily-quota / out-of-credit errors take a while to clear, so skip that provider longer than a per-minute blip. */
export function cooldownFor(error: unknown): number {
  return /per day|\bTPD\b|\bRPD\b|daily|quota|credit balance|billing/i.test(String(error)) ? DAILY_COOLDOWN_MS : COOLDOWN_MS;
}

export function markFailed(c: Candidate, now = Date.now(), ms = COOLDOWN_MS): void {
  cooldown.set(keyOf(c), now + ms);
}

export function clearCooldowns(): void {
  cooldown.clear();
}

/**
 * Candidates to try, in order: those with an API key configured and not cooling down. If every
 * configured one is cooling down, try them all anyway (better a slow answer than none).
 */
export function availableCandidates(chain: Candidate[], env: NodeJS.ProcessEnv = process.env, now = Date.now()): Candidate[] {
  const withKey = chain.filter((c) => !!env[KEY_ENV[c.provider]]?.trim());
  const healthy = withKey.filter((c) => (cooldown.get(keyOf(c)) ?? 0) <= now);
  return healthy.length ? healthy : withKey;
}
