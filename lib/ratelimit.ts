// Best-effort in-memory limiter (per server instance). Protects the free-tier quota from a single visitor
// or a bot; it is not a hard global guarantee on serverless.
const g = globalThis as unknown as { __spiceHits?: Map<string, number[]>; __spiceDay?: { day: string; n: number } };
const hits = (g.__spiceHits ??= new Map<string, number[]>());

export const PER_MINUTE = 12;
// Brute-force protection for sign-in / sign-up: N attempts per window per key (ip + email).
const authGlobal = globalThis as unknown as { __spiceAuth?: Map<string, number[]> };
const authHits = (authGlobal.__spiceAuth ??= new Map<string, number[]>());
export const AUTH_ATTEMPTS = 8;
export const AUTH_WINDOW_MS = 10 * 60_000;

export function checkAuthLimit(key: string, now = Date.now()): boolean {
  const recent = (authHits.get(key) ?? []).filter((t) => now - t < AUTH_WINDOW_MS);
  if (recent.length >= AUTH_ATTEMPTS) {
    authHits.set(key, recent);
    return false;
  }
  recent.push(now);
  authHits.set(key, recent);
  return true;
}

// Paid model: caps double as a cost ceiling (each message is ~2-3 model calls of ~2.5k input tokens).
export const PER_DAY = 40;
export const GLOBAL_PER_DAY = 300;

export function checkRateLimit(key: string, now = Date.now()): { ok: true } | { ok: false; reason: string } {
  const day = new Date(now).toISOString().slice(0, 10);
  const total = (g.__spiceDay = g.__spiceDay?.day === day ? g.__spiceDay : { day, n: 0 });
  if (total.n >= GLOBAL_PER_DAY) return { ok: false, reason: "The demo has reached today's usage limit. Please try again tomorrow." };

  const recent = (hits.get(key) ?? []).filter((t) => now - t < 24 * 3600_000);
  if (recent.length >= PER_DAY) return { ok: false, reason: "Daily message limit reached for this demo. Please come back tomorrow." };
  if (recent.filter((t) => now - t < 60_000).length >= PER_MINUTE)
    return { ok: false, reason: "You're sending messages too quickly. Please wait a minute." };

  recent.push(now);
  hits.set(key, recent);
  total.n++;
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 24 * 3600_000)) hits.delete(k);
  return { ok: true };
}
