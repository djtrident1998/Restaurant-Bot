import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Signed session token: base64url(payload).base64url(HMAC-SHA256). Stateless; the cookie is HttpOnly.
export const SESSION_DAYS = 7;

let ephemeral: string | undefined;

/**
 * SESSION_SECRET if set; otherwise derived from the Blob token (server-only secret) so production needs no extra
 * setup; otherwise a fixed value in development only. In production with neither, a random per-process secret is
 * used (sessions then don't survive restarts, but they are never forgeable with a public default).
 */
export function getSessionSecret(env: NodeJS.ProcessEnv = process.env): string {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  if (env.BLOB_READ_WRITE_TOKEN) return createHash("sha256").update("spice-route-session:" + env.BLOB_READ_WRITE_TOKEN).digest("hex");
  if (env.NODE_ENV !== "production") return "dev-only-insecure-session-secret";
  return (ephemeral ??= randomBytes(32).toString("hex"));
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString("base64url");

export interface TokenPayload {
  uid: string;
  exp: number; // ms epoch
}

export function createToken(userId: string, secret: string, now = Date.now()): string {
  const payload = b64(JSON.stringify({ uid: userId, exp: now + SESSION_DAYS * 86_400_000 } satisfies TokenPayload));
  const sig = createHmac("sha256", secret).update(payload).digest();
  return `${payload}.${b64(sig)}`;
}

export function verifyToken(token: string | undefined, secret: string, now = Date.now()): TokenPayload | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", secret).update(payload).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as TokenPayload;
    return typeof data.uid === "string" && typeof data.exp === "number" && data.exp > now ? data : null;
  } catch {
    return null;
  }
}
