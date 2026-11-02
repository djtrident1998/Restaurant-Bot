// Offline test of the Allergen Shield: profile validation, per-dish fit, the add-to-cart warning, the AI note, storage.
import { ALLERGENS, addWarning, dishFit, hasProfile, normalizeProfile, parseProfile, profileSummary, promptNote } from "../lib/profile";
import { MENU } from "../lib/menu";
import { detectOrderIntent, handleOrderIntent } from "../lib/orderFlow";
import { addRequestText } from "../lib/chatMessages";
import { viewCart } from "../lib/cart";
import { agentConfig } from "../lib/agent";
import { __testing, userIdFor, type UserRecord } from "../lib/auth/store";
import { MockLanguageModelV4 } from "ai/test";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

(async () => {
  // ---- the menu only uses allergens the profile knows about ----
  const used = new Set(MENU.flatMap((d) => d.allergens));
  check("every menu allergen is selectable in the profile", [...used].every((a) => (ALLERGENS as readonly string[]).includes(a)), [...used].join());

  // ---- validation ----
  check("normalize drops unknown allergens", normalizeProfile({ vegOnly: true, avoid: ["nuts", "pollen", "nuts"] }).avoid.join() === "nuts");
  check("normalize keeps a fixed order", normalizeProfile({ vegOnly: false, avoid: ["egg", "nuts"] }).avoid.join() === "nuts,egg");
  check("normalize survives garbage", JSON.stringify(normalizeProfile(null)) === '{"vegOnly":false,"avoid":[]}' && normalizeProfile("x").avoid.length === 0 && normalizeProfile({ avoid: "nuts" }).avoid.length === 0);
  check("vegOnly must be exactly true", normalizeProfile({ vegOnly: "true" }).vegOnly === false);
  check("strict parse accepts a good profile", parseProfile({ vegOnly: false, avoid: ["dairy", "gluten"] }).ok);
  check("strict parse rejects unknown allergen", !parseProfile({ vegOnly: false, avoid: ["moon"] }).ok);
  check("strict parse rejects wrong shapes", !parseProfile(null).ok && !parseProfile({ vegOnly: "yes", avoid: [] }).ok && !parseProfile({ vegOnly: true }).ok && !parseProfile({ vegOnly: true, avoid: "nuts" }).ok);
  check("hasProfile", !hasProfile({ vegOnly: false, avoid: [] }) && hasProfile({ vegOnly: true, avoid: [] }) && hasProfile({ vegOnly: false, avoid: ["fish"] }) && !hasProfile(undefined));

  // ---- fit, against REAL menu items ----
  const nutty = MENU.find((d) => d.allergens.includes("nuts"))!;
  const nonVeg = MENU.find((d) => !d.veg)!;
  const plainVeg = MENU.find((d) => d.veg && d.allergens.length === 0)!;
  const noNuts = { vegOnly: false, avoid: ["nuts" as const] };
  check("no profile -> no badge at all", dishFit(nutty, undefined).status === "none" && dishFit(nutty, { vegOnly: false, avoid: [] }).status === "none");
  const f1 = dishFit(nutty, noNuts);
  check("nut dish flagged for a nut allergy", f1.status === "avoid" && f1.reasons[0] === "contains nuts", nutty.name);
  check("dish without nuts fits", dishFit(plainVeg, noNuts).status === "ok", plainVeg.name);
  check("non-veg dish flagged for vegetarians", (() => { const f = dishFit(nonVeg, { vegOnly: true, avoid: [] }); return f.status === "avoid" && f.reasons.includes("is not vegetarian"); })(), nonVeg.name);
  check("several reasons are all listed", (() => { const d = { veg: false, allergens: ["nuts", "dairy"] }; const f = dishFit(d, { vegOnly: true, avoid: ["nuts", "dairy"] }); return f.status === "avoid" && f.reasons.length === 3; })());
  // exhaustive: for every dish and every single-allergen profile, the flag matches the menu data exactly
  let exact = true;
  for (const d of MENU) for (const a of ALLERGENS) { const f = dishFit(d, { vegOnly: false, avoid: [a] }); if ((f.status === "avoid") !== d.allergens.includes(a)) exact = false; }
  check("all 42 dishes x 5 allergens flagged exactly per menu data", exact && MENU.length === 42);
  check("summary text", profileSummary({ vegOnly: true, avoid: ["nuts", "dairy"] }) === "vegetarian only, avoiding nuts, dairy");

  // ---- add-to-cart warning (deterministic path, no AI) ----
  const S1 = "shield-session-1";
  const intent = detectOrderIntent(addRequestText(nutty.name, 1));
  check("add button text recognised for the nut dish", intent?.type === "add");
  const warned = handleOrderIntent(S1, intent!, true, noNuts);
  check("adding a conflicting dish adds a warning", /Heads up/.test(warned.text) && /contains nuts/.test(warned.text) && /Allergen Shield/.test(warned.text));
  check("…but the dish is still added (customer decides)", viewCart(S1).lines.some((l) => l.name === nutty.name));
  const S2 = "shield-session-2";
  const clean = handleOrderIntent(S2, detectOrderIntent(addRequestText(plainVeg.name, 2))!, true, noNuts);
  check("a safe dish gets no warning", !/Heads up/.test(clean.text));
  const S3 = "shield-session-3";
  const guestNoProfile = handleOrderIntent(S3, detectOrderIntent(addRequestText(nutty.name, 1))!, false, undefined);
  check("no profile (guest / not set) -> no warning", !/Heads up/.test(guestNoProfile.text));
  check("warning text is empty for fitting dishes", addWarning("X", { status: "ok" }) === "" && addWarning("X", { status: "none" }) === "");

  // ---- the AI is told about the profile (only when there is one) ----
  const model = new MockLanguageModelV4({ doGenerate: async () => ({ content: [], finishReason: "stop", usage: { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } }, warnings: [] }) as never });
  const withP = agentConfig("s", "v2", model, true, { vegOnly: true, avoid: ["nuts"] }).system as string;
  const without = agentConfig("s", "v2", model, true, undefined).system as string;
  check("system prompt carries the profile", /CUSTOMER FOOD PROFILE/.test(withP) && /vegetarian only, avoiding nuts/.test(withP));
  check("no profile -> prompt unchanged (evals unaffected)", !/CUSTOMER FOOD PROFILE/.test(without) && promptNote({ vegOnly: false, avoid: [] }) === "");
  check("the note is short (token cost)", promptNote({ vegOnly: true, avoid: ["nuts", "dairy", "gluten", "fish", "egg"] }).length < 400);

  // ---- storage ----
  const store = new __testing.MemoryStore();
  const mk = (email: string): UserRecord => ({ id: userIdFor(email), name: "T", email, passwordHash: "x", createdAt: 1, orders: [] });
  const a = mk("shield-a@example.com");
  const b = mk("shield-b@example.com");
  await store.create(a);
  await store.create(b);
  const upd = await store.updateUser(a.id, (u) => { u.profile = { vegOnly: true, avoid: ["nuts"] }; return true; });
  check("profile saved on the account", upd?.profile?.vegOnly === true && (await store.findById(a.id))?.profile?.avoid[0] === "nuts");
  check("another account untouched", (await store.findById(b.id))?.profile === undefined);
  check("unknown account -> null", (await store.updateUser("nope", () => true)) === null);

  console.log(fails ? `\n${fails} FAILED` : "\nAll Allergen Shield checks passed");
  process.exit(fails ? 1 : 0);
})();
