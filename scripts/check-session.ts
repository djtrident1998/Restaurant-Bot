// Offline test: loading the signed-in account must be safe when storage fails, and must read the account only once.
import { resolveAccount } from "../lib/auth/session";
import { createToken } from "../lib/auth/token";
import { __testing, userIdFor, type UserRecord, type UserStore } from "../lib/auth/store";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

(async () => {
  const secret = "test-secret";
  const store = new __testing.MemoryStore();
  const u: UserRecord = {
    id: userIdFor("sess@example.com"), name: "Sess Tester", email: "sess@example.com", passwordHash: "x", createdAt: 1,
    orders: [{ id: "SR-1111", total: 100, placedAt: 5, lines: [{ name: "Dal", qty: 1, lineTotal: 100 }] }],
    profile: { vegOnly: true, avoid: ["nuts"] },
  };
  await store.create(u);
  const token = createToken(u.id, secret);

  // ---- normal ----
  const a = await resolveAccount(token, secret, store);
  check("valid session loads the account", a?.user.id === u.id && a.user.name === "Sess Tester");
  check("orders come from the same read", a?.orders.length === 1 && a.orders[0].id === "SR-1111");
  check("profile is normalised", a?.user.profile.vegOnly === true && a.user.profile.avoid[0] === "nuts");
  check("the password hash never leaves the loader", !JSON.stringify(a?.user).includes("passwordHash") && !("passwordHash" in (a?.user ?? {})));

  // ---- bad sessions ----
  check("no token -> signed out", (await resolveAccount(undefined, secret, store)) === null);
  check("forged token -> signed out", (await resolveAccount(token + "x", secret, store)) === null);
  check("token signed with another secret -> signed out", (await resolveAccount(createToken(u.id, "other"), secret, store)) === null);
  check("token for a deleted account -> signed out", (await resolveAccount(createToken(userIdFor("gone@example.com"), secret), secret, store)) === null);

  // ---- storage failure must not crash the page ----
  let reads = 0;
  const flaky: UserStore = { ...store, findById: async () => { reads++; throw new Error("blob network error"); } } as unknown as UserStore;
  const logged: string[] = [];
  const origErr = console.error;
  console.error = (...args: unknown[]) => { logged.push(args.join(" ")); };
  let threw = false;
  let res: unknown = "unset";
  try { res = await resolveAccount(token, secret, flaky); } catch { threw = true; }
  console.error = origErr;
  check("a storage error does not throw", !threw);
  check("…the visitor is treated as signed out (the safe direction)", res === null);
  check("…the error is logged, without leaking details", logged.length === 1 && /could not load account/.test(logged[0]) && logged[0].length < 220);
  check("exactly one read attempted", reads === 1);

  // a slow-then-ok store still returns the account
  const slow: UserStore = { ...store, findById: async (id: string) => { await new Promise((r) => setTimeout(r, 50)); return store.findById(id); } } as unknown as UserStore;
  check("a slow store still works", (await resolveAccount(token, secret, slow))?.user.id === u.id);

  console.log(fails ? `\n${fails} FAILED` : "\nAll session checks passed");
  process.exit(fails ? 1 : 0);
})();
