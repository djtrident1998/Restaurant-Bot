// Offline test of order cancellation + refund: window, ownership, one-refund-only, chat intent, invoice stamp.
import { cancelEligibility, cancelOrder, cancelWindowMs, detectCancelIntent, handleCancelIntent, refundRefFor } from "../lib/cancel";
import { buildInvoiceData, renderInvoicePdf } from "../lib/invoice";
import { checkUserInput } from "../lib/guardrails";
import { __testing, userIdFor, type UserRecord } from "../lib/auth/store";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

const NOW = Date.UTC(2026, 10, 2, 12, 0, 0);
const MIN = 60_000;
const W = 10 * MIN;
const mk = (email: string, orders: { id: string; ageMin: number; total?: number }[]): UserRecord => ({
  id: userIdFor(email),
  name: email.split("@")[0],
  email,
  passwordHash: "x",
  createdAt: 1,
  orders: orders.map((o) => ({ id: o.id, total: o.total ?? 560, placedAt: NOW - o.ageMin * MIN, lines: [{ name: "Butter Chicken", qty: 2, lineTotal: o.total ?? 560 }] })),
});

(async () => {
  // ---- window config ----
  check("default window 10 minutes", cancelWindowMs({} as NodeJS.ProcessEnv) === W);
  check("env window", cancelWindowMs({ CANCEL_WINDOW_MINUTES: "3" } as unknown as NodeJS.ProcessEnv) === 3 * MIN);
  check("garbage env -> default", cancelWindowMs({ CANCEL_WINDOW_MINUTES: "abc" } as unknown as NodeJS.ProcessEnv) === W);
  check("0 disables cancelling", !cancelEligibility({ placedAt: NOW - 1 }, NOW, cancelWindowMs({ CANCEL_WINDOW_MINUTES: "0" } as unknown as NodeJS.ProcessEnv)).ok);

  // ---- eligibility ----
  check("fresh order eligible", cancelEligibility({ placedAt: NOW - 2 * MIN }, NOW, W).ok);
  check("just inside window", cancelEligibility({ placedAt: NOW - (W - 1) }, NOW, W).ok);
  check("exactly at window -> too late", !cancelEligibility({ placedAt: NOW - W }, NOW, W).ok);
  check("old order not eligible", !cancelEligibility({ placedAt: NOW - 60 * MIN }, NOW, W).ok);
  check("cancelled order not eligible", cancelEligibility({ placedAt: NOW, cancelledAt: NOW }, NOW, W).ok === false);

  // ---- cancelling ----
  const store = new __testing.MemoryStore();
  const asha = mk("asha-cx@example.com", [{ id: "SR-1111", ageMin: 2, total: 560 }, { id: "SR-2222", ageMin: 30 }, { id: "SR-4444", ageMin: 1, total: 300 }]);
  const ravi = mk("ravi-cx@example.com", [{ id: "SR-3333", ageMin: 1 }]);
  await store.create(asha);
  await store.create(ravi);

  const r1 = await cancelOrder(store, asha.id, "SR-1111", NOW, W);
  check("cancel inside window ok", r1.ok);
  check("full refund = order total", r1.ok && r1.refund.amount === 560 && r1.refund.ref === refundRefFor("SR-1111"), JSON.stringify(r1.ok ? r1.refund : r1));
  check("refund ref format", refundRefFor("SR-1111") === "RF-1111");
  const saved = (await store.findById(asha.id))!.orders.find((o) => o.id === "SR-1111")!;
  check("order stored as cancelled", saved.cancelledAt === NOW && saved.refund?.amount === 560);

  const r2 = await cancelOrder(store, asha.id, "SR-1111", NOW + 1000, W);
  check("second cancel refused (no double refund)", !r2.ok && r2.status === 409);
  check("refund unchanged after retry", (await store.findById(asha.id))!.orders.find((o) => o.id === "SR-1111")!.refund?.at === NOW);

  const both = await Promise.all([cancelOrder(store, asha.id, "SR-4444", NOW, W), cancelOrder(store, asha.id, "SR-4444", NOW, W)]);
  check("two simultaneous cancels -> exactly one refund", both.filter((x) => x.ok).length === 1);

  const late = await cancelOrder(store, asha.id, "SR-2222", NOW, W);
  check("too late refused", !late.ok && late.status === 409 && /minutes/.test(late.ok ? "" : late.error));
  check("late order untouched", !(await store.findById(asha.id))!.orders.find((o) => o.id === "SR-2222")!.cancelledAt);

  const other = await cancelOrder(store, asha.id, "SR-3333", NOW, W);
  check("someone else's order -> not found", !other.ok && other.status === 404);
  check("other customer's order untouched", !(await store.findById(ravi.id))!.orders[0].cancelledAt);
  check("unknown order -> 404", (await cancelOrder(store, asha.id, "SR-9999", NOW, W)).ok === false);
  check("bad id -> 400", !(await cancelOrder(store, asha.id, "../etc", NOW, W)).ok && (await cancelOrder(store, asha.id, 42, NOW, W)).ok === false);
  check("lowercase id accepted", (await cancelOrder(store, ravi.id, "sr-3333", NOW, W)).ok);

  // ---- chat intent ----
  const yes = ["cancel my order", "Cancel order", "please cancel my last order", "cancel order SR-1234", "Cancel my order SR-1234 please", "cancel sr-1234", "i want a refund", "refund my order", "I want to cancel my order", "can you cancel my order", "refund me"];
  check("cancel/refund phrases recognised", yes.every((t) => detectCancelIntent(t) !== null), yes.filter((t) => !detectCancelIntent(t)).join("|"));
  check("order id extracted", detectCancelIntent("cancel order sr-1234")?.orderId === "SR-1234");
  const no = ["cancel", "no", "what is your cancellation policy for dishes", "do you cancel orders for allergies?", "add 2 butter chicken to my cart", "is the order spicy", "cancel the starter and add a naan", "show me the menu", "refund policy?"];
  check("ordinary talk NOT treated as cancel", no.every((t) => detectCancelIntent(t) === null), no.filter((t) => detectCancelIntent(t)).join("|"));
  check("cancel phrases pass the scope gate", yes.every((t) => checkUserInput(t).ok), yes.filter((t) => !checkUserInput(t).ok).join("|"));

  const store2 = new __testing.MemoryStore();
  const meera = mk("meera-cx@example.com", [{ id: "SR-5555", ageMin: 3, total: 750 }, { id: "SR-6666", ageMin: 50 }]);
  await store2.create(meera);
  const guest = await handleCancelIntent(store2, undefined, {}, NOW, W);
  check("guest asked to sign in", /sign in/i.test(guest.text) && guest.outputs.length === 0);
  const offer = await handleCancelIntent(store2, meera.id, {}, NOW, W);
  check("latest order offered with a button", offer.outputs[0]?.toolName === "cancel_offer" && (offer.outputs[0].output as { orderId: string }).orderId === "SR-5555", offer.text);
  check("offer states full refund", /full ₹750/.test(offer.text));
  check("chat reply alone did NOT cancel", !(await store2.findById(meera.id))!.orders[0].cancelledAt);
  const tooLate = await handleCancelIntent(store2, meera.id, { orderId: "SR-6666" }, NOW, W);
  check("old order explained, no button", tooLate.outputs.length === 0 && /minutes/.test(tooLate.text));
  const missing = await handleCancelIntent(store2, meera.id, { orderId: "SR-0000" }, NOW, W);
  check("unknown order id -> not found text", /couldn't find/.test(missing.text) && missing.outputs.length === 0);
  const none = await handleCancelIntent(store2, userIdFor("nobody@example.com"), {}, NOW, W);
  check("no orders -> friendly text", /nothing to cancel/.test(none.text));
  await cancelOrder(store2, meera.id, "SR-5555", NOW, W);
  const again = await handleCancelIntent(store2, meera.id, {}, NOW, W);
  check("already cancelled -> says so", /already been cancelled/.test(again.text) && again.outputs.length === 0);

  // ---- invoice ----
  const rec = (await store2.findById(meera.id))!;
  const inv = buildInvoiceData({ name: "Meera", email: rec.email }, rec.orders[0]);
  check("invoice carries cancellation + refund", inv.cancelled?.refundAmount === 750 && inv.cancelled.refundRef === "RF-5555");
  const pdf = await renderInvoicePdf(inv);
  check("cancelled invoice renders a PDF", Buffer.from(pdf.slice(0, 5)).toString() === "%PDF-" && pdf.length > 1000);
  check("normal invoice has no cancel block", buildInvoiceData({ name: "Meera", email: rec.email }, rec.orders[1]).cancelled === undefined);

  console.log(fails ? `\n${fails} FAILED` : "\nAll cancel/refund checks passed");
  process.exit(fails ? 1 : 0);
})();
