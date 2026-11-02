import { feedbackSchema, MAX_COMMENT, submitFeedback } from "../lib/feedback";
import { __testing, userIdFor, type UserRecord } from "../lib/auth/store";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

const mk = (email: string, orderIds: string[]): UserRecord => ({
  id: userIdFor(email),
  name: email.split("@")[0],
  email,
  passwordHash: "x",
  createdAt: 1,
  orders: orderIds.map((id) => ({ id, total: 100, placedAt: 2, lines: [{ name: "Dish", qty: 1, lineTotal: 100 }] })),
});

(async () => {
  const store = new __testing.MemoryStore();
  const asha = mk("asha-fb@example.com", ["SR-1111", "SR-2222"]);
  const ravi = mk("ravi-fb@example.com", ["SR-3333"]);
  await store.create(asha);
  await store.create(ravi);

  // ---- validation ----
  const ok = (o: unknown) => feedbackSchema.safeParse(o).success;
  check("1 to 5 stars accepted", [1, 2, 3, 4, 5].every((r) => ok({ orderId: "SR-1111", rating: r })));
  check("0, 6, 3.5, -1 rejected", ![0, 6, 3.5, -1].some((r) => ok({ orderId: "SR-1111", rating: r })));
  check('rating as text ("5") rejected', !ok({ orderId: "SR-1111", rating: "5" }));
  check("missing rating / order id rejected", !ok({ orderId: "SR-1111" }) && !ok({ rating: 5 }));
  check("comment optional", ok({ orderId: "SR-1111", rating: 5 }));
  check(`comment over ${MAX_COMMENT} chars rejected`, !ok({ orderId: "SR-1111", rating: 5, comment: "x".repeat(MAX_COMMENT + 1) }));
  check("odd order id (path/markup) rejected", !ok({ orderId: "../../etc", rating: 5 }) && !ok({ orderId: "<script>", rating: 5 }));

  // ---- saving ----
  const r1 = await submitFeedback(store, asha.id, { orderId: "SR-1111", rating: 5, comment: "  Wonderful butter chicken!  " }, 1234);
  check("rating saved with a trimmed comment", r1.ok && r1.feedback.rating === 5 && r1.feedback.comment === "Wonderful butter chicken!" && r1.feedback.at === 1234);
  check("stored on the order in the account", (await store.findById(asha.id))?.orders[0].feedback?.rating === 5);
  check("the other order is untouched", (await store.findById(asha.id))?.orders[1].feedback === undefined);

  const r2 = await submitFeedback(store, asha.id, { orderId: "SR-1111", rating: 3, comment: "Changed my mind" });
  check("rating can be updated", r2.ok && (await store.findById(asha.id))?.orders[0].feedback?.rating === 3);

  // ---- isolation: you can only rate YOUR orders ----
  const steal = await submitFeedback(store, ravi.id, { orderId: "SR-1111", rating: 1, comment: "sabotage" });
  check("cannot rate someone else's order (404)", !steal.ok && steal.status === 404);
  check("the other customer's order was not changed", (await store.findById(asha.id))?.orders[0].feedback?.comment === "Changed my mind");
  const missing = await submitFeedback(store, asha.id, { orderId: "SR-9999", rating: 4 });
  check("unknown order -> 404", !missing.ok && missing.status === 404);
  const bad = await submitFeedback(store, asha.id, { orderId: "SR-2222", rating: 9 });
  check("invalid rating -> 400 with a friendly message", !bad.ok && bad.status === 400 && /1 to 5/.test(bad.error));
  const ghost = await submitFeedback(store, "nobody", { orderId: "SR-1111", rating: 5 });
  check("unknown user -> 404", !ghost.ok && ghost.status === 404);

  // ---- hostile text is stored as inert text; control characters are stripped ----
  const html = '<script>alert(1)</script> <img src=x onerror=alert(2)>';
  const r3 = await submitFeedback(store, asha.id, { orderId: "SR-2222", rating: 4, comment: html + "\u0000\u0007 ok" });
  check("markup kept as plain text (React never renders it as HTML)", r3.ok && r3.feedback.comment.startsWith("<script>") && r3.feedback.comment.endsWith("ok"));
  check("control characters stripped", r3.ok && !/[\u0000-\u0008]/.test(r3.feedback.comment));
  check("empty comment allowed (stars only)", (await submitFeedback(store, asha.id, { orderId: "SR-2222", rating: 5, comment: "   " })).ok);

  process.exit(fails ? 1 : 0);
})();
