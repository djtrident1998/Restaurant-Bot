// Offline test of "your data, your control": export (no password hash) and password-confirmed permanent deletion.
import { deleteAccount, exportAccount } from "../lib/account";
import { hashPassword } from "../lib/auth/password";
import { __testing, userIdFor, type UserRecord } from "../lib/auth/store";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

(async () => {
  const store = new __testing.MemoryStore();
  const mk = async (email: string, pw: string): Promise<UserRecord> => ({
    id: userIdFor(email),
    name: email.split("@")[0],
    email,
    passwordHash: await hashPassword(pw),
    createdAt: 1,
    orders: [{ id: "SR-1111", total: 300, placedAt: 2, lines: [{ name: "Dal", qty: 1, lineTotal: 300 }], feedback: { rating: 5, comment: "great", at: 3 } }],
    profile: { vegOnly: true, avoid: ["nuts"] },
  });
  const asha = await mk("asha-pv@example.com", "Correct-horse-9");
  const ravi = await mk("ravi-pv@example.com", "Another-pass-7");
  await store.create(asha);
  await store.create(ravi);

  // ---- export ----
  const ex = exportAccount(asha, Date.UTC(2026, 10, 2));
  const json = JSON.stringify(ex);
  check("export has the account data", ex.account.email === "asha-pv@example.com" && ex.account.orders.length === 1 && ex.account.profile?.vegOnly === true);
  check("export never contains the password hash", !json.includes("passwordHash") && !json.includes("scrypt$"));
  check("export is dated", ex.exportedAt === "2026-11-02T00:00:00.000Z");
  check("export includes ratings", json.includes('"comment":"great"'));

  // ---- deletion ----
  const noPw = await deleteAccount(store, asha.id, "");
  check("empty password refused", !noPw.ok && !!(await store.findById(asha.id)));
  const wrong = await deleteAccount(store, asha.id, "wrong-password-1");
  check("wrong password refused, account kept", !wrong.ok && !!(await store.findById(asha.id)));
  check("non-string password refused", !(await deleteAccount(store, asha.id, 12345)).ok && !(await deleteAccount(store, asha.id, null)).ok);
  const theirs = await deleteAccount(store, asha.id, "Another-pass-7");
  check("someone else's password can't delete your account", !theirs.ok && !!(await store.findById(asha.id)));
  const ok = await deleteAccount(store, asha.id, "Correct-horse-9");
  check("correct password deletes the account", ok.ok && (await store.findById(asha.id)) === null);
  check("sign-in lookup by email finds nothing afterwards", (await store.findByEmail("asha-pv@example.com")) === null);
  check("other accounts untouched", !!(await store.findById(ravi.id)) && (await store.findById(ravi.id))!.orders.length === 1);
  const again = await deleteAccount(store, asha.id, "Correct-horse-9");
  check("deleting twice is a clean refusal", !again.ok);
  check("the same email can sign up again after deletion", await store.create(await mk("asha-pv@example.com", "Fresh-start-5")));

  console.log(fails ? `\n${fails} FAILED` : "\nAll privacy checks passed");
  process.exit(fails ? 1 : 0);
})();
