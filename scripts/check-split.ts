// Offline test of group-order bill splitting: exact maths, validation, ownership, locking, cancel interaction.
import { computeSplit, divide, type SplitLine } from "../lib/split";
import { saveSplit, setSharePaid } from "../lib/splitOrder";
import { cancelOrder } from "../lib/cancel";
import { __testing, userIdFor, type UserRecord } from "../lib/auth/store";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

const lines: SplitLine[] = [
  { name: "Paneer Tikka", qty: 2, lineTotal: 560 },
  { name: "Butter Naan", qty: 3, lineTotal: 180 },
  { name: "Mango Lassi", qty: 1, lineTotal: 130 },
];
const TOTAL = 870;
const sum = (xs: { amount: number }[]) => xs.reduce((n, x) => n + x.amount, 0);

(async () => {
  // ---- divide ----
  check("divide adds up", divide(100, 3).reduce((a, b) => a + b, 0) === 100 && divide(100, 3).join() === "34,33,33");
  check("divide exact", divide(90, 3).join() === "30,30,30");
  check("divide fewer rupees than people", divide(2, 5).join() === "1,1,0,0,0");

  // ---- equal split ----
  const eq = computeSplit(lines, { mode: "equal", people: ["Asha", "Ravi", "Meera"] });
  check("equal split ok", eq.ok);
  check("equal shares add to total", eq.ok && sum(eq.shares) === TOTAL, eq.ok ? JSON.stringify(eq.shares) : "");
  check("equal shares differ by at most Rs 1", eq.ok && Math.max(...eq.shares.map((s) => s.amount)) - Math.min(...eq.shares.map((s) => s.amount)) <= 1);

  // ---- by items ----
  const it = computeSplit(lines, { mode: "items", people: ["Asha", "Ravi", "Meera"], assign: [[0], [], [1, 2]] });
  check("item split ok", it.ok);
  check("item split adds to total", it.ok && sum(it.shares) === TOTAL, it.ok ? JSON.stringify(it.shares) : "");
  check("Asha pays her tikka + a third of the naan", it.ok && it.shares[0].amount === 560 + 60);
  check("Ravi and Meera share the lassi", it.ok && it.shares[1].amount + it.shares[2].amount === 60 + 60 + 130);
  const odd = computeSplit([{ name: "Dal", qty: 1, lineTotal: 100 }, { name: "Dal2", qty: 1, lineTotal: 100 }], { mode: "items", people: ["A", "B", "C"], assign: [[], []] });
  check("odd amounts still exact", odd.ok && sum(odd.shares) === 200, odd.ok ? JSON.stringify(odd.shares) : "");
  check("extra rupee rotates between dishes", odd.ok && Math.max(...odd.shares.map((s) => s.amount)) - Math.min(...odd.shares.map((s) => s.amount)) <= 1);

  // random property check: shares always add up exactly
  let allExact = true;
  for (let t = 0; t < 300; t++) {
    const n = 2 + Math.floor(Math.random() * 11);
    const ls: SplitLine[] = Array.from({ length: 1 + Math.floor(Math.random() * 6) }, (_, i) => ({ name: `d${i}`, qty: 1, lineTotal: 1 + Math.floor(Math.random() * 999) }));
    const people = Array.from({ length: n }, (_, i) => `P${i}`);
    const assign = ls.map(() => (Math.random() < 0.3 ? [] : people.map((_, i) => i).filter(() => Math.random() < 0.5)));
    const r = computeSplit(ls, { mode: "items", people, assign });
    if (!r.ok || sum(r.shares) !== ls.reduce((a, l) => a + l.lineTotal, 0)) allExact = false;
  }
  check("300 random splits always add up exactly", allExact);

  // ---- validation ----
  const no = (spec: unknown) => !computeSplit(lines, spec).ok;
  check("one person refused", no({ mode: "equal", people: ["Asha"] }));
  check("13 people refused", no({ mode: "equal", people: Array.from({ length: 13 }, (_, i) => `P${i}`) }));
  check("duplicate names refused (case-insensitive)", no({ mode: "equal", people: ["Asha", "asha"] }));
  check("empty name refused", no({ mode: "equal", people: ["Asha", "  "] }));
  check("very long name refused", no({ mode: "equal", people: ["Asha", "x".repeat(31)] }));
  check("unknown mode refused", no({ mode: "pay-what-you-like", people: ["A", "B"] }));
  check("garbage refused", no(null) && no("x") && no({}) && no({ mode: "equal" }));
  check("assign of wrong length refused", no({ mode: "items", people: ["A", "B"], assign: [[0]] }));
  check("person index out of range refused", no({ mode: "items", people: ["A", "B"], assign: [[0], [5], []] }));
  check("negative / fractional index refused", no({ mode: "items", people: ["A", "B"], assign: [[-1], [], []] }) && no({ mode: "items", people: ["A", "B"], assign: [[0.5], [], []] }));
  check("repeated person on one dish refused", no({ mode: "items", people: ["A", "B"], assign: [[0, 0], [], []] }));
  check("empty order refused", !computeSplit([], { mode: "equal", people: ["A", "B"] }).ok);
  const ctl = computeSplit(lines, { mode: "equal", people: ["As\u0000ha", "Ravi"] });
  check("control characters stripped from names", ctl.ok && ctl.shares[0].name === "Asha");
  check("browser-supplied amounts are ignored", (() => { const r = computeSplit(lines, { mode: "equal", people: ["A", "B"], amounts: [1, 1] }); return r.ok && sum(r.shares) === TOTAL; })());

  // ---- saving on an account ----
  const store = new __testing.MemoryStore();
  const mk = (email: string, id: string): UserRecord => ({
    id: userIdFor(email), name: email.split("@")[0], email, passwordHash: "x", createdAt: 1,
    orders: [{ id, total: TOTAL, placedAt: Date.now(), lines: lines.map((l) => ({ ...l })) }],
  });
  const asha = mk("asha-sp@example.com", "SR-1111");
  const ravi = mk("ravi-sp@example.com", "SR-2222");
  await store.create(asha);
  await store.create(ravi);

  const saved = await saveSplit(store, asha.id, "SR-1111", { mode: "equal", people: ["Asha", "Ravi", "Meera"] });
  check("split saved on the order", saved.ok && saved.order.split?.people.length === 3 && saved.order.split.people.every((p) => !p.paid));
  check("saved amounts add to total", saved.ok && sum(saved.order.split!.people) === TOTAL);
  const redo = await saveSplit(store, asha.id, "sr-1111", { mode: "items", people: ["Asha", "Ravi"], assign: [[0], [1], []] });
  check("split can be changed before anyone pays (id case-insensitive)", redo.ok && redo.order.split?.mode === "items");
  check("someone else's order -> 404", !(await saveSplit(store, asha.id, "SR-2222", { mode: "equal", people: ["A", "B"] })).ok);
  check("their order untouched", !(await store.findById(ravi.id))!.orders[0].split);
  check("bad id -> 400", (await saveSplit(store, asha.id, "../x", { mode: "equal", people: ["A", "B"] }) as { status?: number }).status === 400);
  const badSpec = await saveSplit(store, asha.id, "SR-1111", { mode: "equal", people: ["A"] });
  check("invalid split rejected and old one kept", !badSpec.ok && (await store.findById(asha.id))!.orders[0].split?.mode === "items");

  const paid = await setSharePaid(store, asha.id, "SR-1111", 0, true);
  check("mark a share paid", paid.ok && paid.order.split!.people[0].paid === true && paid.order.split!.people[1].paid === false);
  check("unmark paid", (await setSharePaid(store, asha.id, "SR-1111", 0, false)).ok);
  await setSharePaid(store, asha.id, "SR-1111", 1, true);
  const locked = await saveSplit(store, asha.id, "SR-1111", { mode: "equal", people: ["A", "B"] });
  check("split locked once someone has paid", !locked.ok && locked.status === 409);
  check("bad person index refused", !(await setSharePaid(store, asha.id, "SR-1111", 9, true)).ok);
  check("non-boolean paid refused", !(await setSharePaid(store, asha.id, "SR-1111", 0, "yes")).ok);
  check("cannot mark someone else's order paid", !(await setSharePaid(store, ravi.id, "SR-1111", 0, true)).ok);

  // ---- cancel interaction ----
  const meera = mk("meera-sp@example.com", "SR-3333");
  await store.create(meera);
  await saveSplit(store, meera.id, "SR-3333", { mode: "equal", people: ["Meera", "Dev"] });
  const c = await cancelOrder(store, meera.id, "SR-3333");
  check("cancelling clears the split", c.ok && !(await store.findById(meera.id))!.orders[0].split);
  check("cannot split a cancelled order", !(await saveSplit(store, meera.id, "SR-3333", { mode: "equal", people: ["A", "B"] })).ok);

  console.log(fails ? `\n${fails} FAILED` : "\nAll split-bill checks passed");
  process.exit(fails ? 1 : 0);
})();
