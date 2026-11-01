import { hashPassword, verifyPassword, dummyHash } from "../lib/auth/password";
import { createToken, verifyToken, getSessionSecret, SESSION_DAYS } from "../lib/auth/token";
import { loginSchema, signupSchema } from "../lib/auth/schemas";
import { __testing, normalizeEmail, userIdFor, type UserRecord } from "../lib/auth/store";
import { AUTH_ATTEMPTS, AUTH_WINDOW_MS, checkAuthLimit } from "../lib/ratelimit";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};
const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;

(async () => {
  // ---- passwords ----
  const h = await hashPassword("Correct-horse-9");
  check("hash is salted scrypt, not the password", h.startsWith("scrypt$") && !h.includes("Correct"));
  check("two hashes of the same password differ (random salt)", h !== (await hashPassword("Correct-horse-9")));
  check("right password verifies", await verifyPassword("Correct-horse-9", h));
  check("wrong password rejected", !(await verifyPassword("correct-horse-9", h)));
  check("garbage stored hash rejected, no crash", !(await verifyPassword("x", "nonsense")));
  check("dummy hash never matches a real password", !(await verifyPassword("anything", await dummyHash())));

  // ---- session tokens ----
  const secret = "test-secret";
  const now = 1_700_000_000_000;
  const tok = createToken("user-1", secret, now);
  check("valid token verifies", verifyToken(tok, secret, now + 1000)?.uid === "user-1");
  check("expires after the session window", verifyToken(tok, secret, now + (SESSION_DAYS * 86_400_000 + 1000)) === null);
  check("wrong secret rejected", verifyToken(tok, "other-secret", now + 1000) === null);
  const [p, s] = tok.split(".");
  const forged = Buffer.from(JSON.stringify({ uid: "admin", exp: now + 9e12 })).toString("base64url");
  check("forged payload with old signature rejected", verifyToken(`${forged}.${s}`, secret, now + 1000) === null);
  check("tampered signature rejected", verifyToken(`${p}.${s.slice(0, -2)}AA`, secret, now + 1000) === null);
  check("empty / malformed tokens rejected", verifyToken(undefined, secret) === null && verifyToken("abc", secret) === null && verifyToken("a.b", secret) === null);

  // ---- session secret selection ----
  check("SESSION_SECRET wins", getSessionSecret(env({ SESSION_SECRET: "abc", BLOB_READ_WRITE_TOKEN: "t" })) === "abc");
  const derived = getSessionSecret(env({ BLOB_READ_WRITE_TOKEN: "blob-token-xyz" }));
  check("derived from blob token, not the token itself", derived.length === 64 && !derived.includes("blob-token-xyz"));
  check("dev fallback outside production", getSessionSecret(env({ NODE_ENV: "development" })) === "dev-only-insecure-session-secret");
  const prod1 = getSessionSecret(env({ NODE_ENV: "production" }));
  check("production without any secret never uses the public dev value", prod1 !== "dev-only-insecure-session-secret" && prod1.length === 64);

  // ---- validation ----
  check("good signup accepted & email lowercased", signupSchema.safeParse({ name: " Asha ", email: "Asha@Example.COM ", password: "Passw0rdOK" }).data?.email === "asha@example.com");
  check("short password rejected", !signupSchema.safeParse({ name: "Asha", email: "a@b.co", password: "a1" }).success);
  check("password without a number rejected", !signupSchema.safeParse({ name: "Asha", email: "a@b.co", password: "onlyletters" }).success);
  check("password without a letter rejected", !signupSchema.safeParse({ name: "Asha", email: "a@b.co", password: "12345678" }).success);
  check("bad email rejected", !signupSchema.safeParse({ name: "Asha", email: "not-an-email", password: "Passw0rdOK" }).success);
  check("one-letter name rejected", !signupSchema.safeParse({ name: "A", email: "a@b.co", password: "Passw0rdOK" }).success);
  check("login needs a password", !loginSchema.safeParse({ email: "a@b.co", password: "" }).success);

  // ---- store ----
  const store = new __testing.MemoryStore();
  const user: UserRecord = { id: userIdFor("Asha@Example.com"), name: "Asha", email: "asha@example.com", passwordHash: h, createdAt: now, orders: [] };
  check("email normalisation gives one id for any casing/spaces", userIdFor(" ASHA@example.COM ") === userIdFor("asha@example.com") && normalizeEmail(" A@B.C ") === "a@b.c");
  check("create works", await store.create(user));
  check("duplicate email refused (any casing)", !(await store.create({ ...user, id: userIdFor("ASHA@EXAMPLE.COM"), name: "Imposter" })));
  check("find by email is case-insensitive", (await store.findByEmail("ASHA@example.com"))?.name === "Asha");
  check("unknown email -> null", (await store.findByEmail("nobody@example.com")) === null);
  await store.addOrder(user.id, { id: "SR-1234", total: 545, placedAt: now, lines: [{ name: "Chana Masala", qty: 2, lineTotal: 440 }] });
  check("order saved to the account", (await store.findById(user.id))?.orders[0]?.id === "SR-1234");

  // ---- brute-force limiter ----
  let allowed = 0;
  for (let i = 0; i < AUTH_ATTEMPTS + 4; i++) if (checkAuthLimit("login:1.2.3.4:a@b.co", 1000 + i)) allowed++;
  check(`only ${AUTH_ATTEMPTS} attempts allowed per window`, allowed === AUTH_ATTEMPTS, `(allowed ${allowed})`);
  check("other accounts/IPs unaffected", checkAuthLimit("login:9.9.9.9:c@d.co", 1500));
  check("window expires", checkAuthLimit("login:1.2.3.4:a@b.co", 1000 + AUTH_WINDOW_MS + 100));

  process.exit(fails ? 1 : 0);
})();
