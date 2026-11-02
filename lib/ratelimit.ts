import { getLimits } from "./config";

// Best-effort in-memory limiter (per server instance). Protects the free-tier quota from a single visitor
// or a bot. It is NOT a hard global guarantee on serverless (each instance has its own memory) — the shared,
// hard cost ceiling is the paid-model daily budget in lib/budget.ts.
const g = globalThis as unknown as { __spiceHits?: Map<string, number[]>; __spiceDay?: { day: string; n: number } };
const hits = (g.__spiceHits ??= new Map<string, number[]>());

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

export function checkRateLimit(key: string, now = Date.now(), limits = getLimits()): { ok: true } | { ok: false; reason: string } {
  const day = new Date(now).toISOString().slice(0, 10);
  const total = (g.__spiceDay = g.__spiceDay?.day === day ? g.__spiceDay : { day, n: 0 });
  if (total.n >= limits.globalPerDay) return { ok: false, reason: "The AI chat has reached today's limit. Menu, cart and ordering buttons still work — and the chat will be back tomorrow." };

  const recent = (hits.get(key) ?? []).filter((t) => now - t < 24 * 3600_000);
  if (recent.length >= limits.perDay) return { ok: false, reason: "You've reached today's AI chat limit for this demo. The menu, cart and ordering buttons still work, and the chat resets tomorrow." };
  if (recent.filter((t) => now - t < 60_000).length >= limits.perMinute) return { ok: false, reason: "You're sending messages too quickly. Please wait a minute." };

  recent.push(now);
  hits.set(key, recent);
  total.n++;
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < 24 * 3600_000)) hits.delete(k);
  return { ok: true };
}
