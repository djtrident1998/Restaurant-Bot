import type { OrderRecord, UserStore } from "./auth/store";
import { ORDER_ID_RE } from "./cancel";
import { computeSplit } from "./split";

export type SplitSaveResult = { ok: true; order: OrderRecord } | { ok: false; status: 400 | 404 | 409; error: string };

const bad = (status: 400 | 404 | 409, error: string): SplitSaveResult => ({ ok: false, status, error });

/**
 * Save how the bill is divided for one of the signed-in customer's own orders. The amounts are recomputed here from the
 * STORED order (never taken from the browser). Once anyone is marked paid the split is locked, so recorded payments
 * can't be silently reshuffled.
 */
export async function saveSplit(store: UserStore, userId: string, rawOrderId: unknown, spec: unknown, now = Date.now()): Promise<SplitSaveResult> {
  const orderId = typeof rawOrderId === "string" ? rawOrderId.trim().toUpperCase() : "";
  if (!ORDER_ID_RE.test(orderId)) return bad(400, "Please give an order id like SR-1234.");

  let refused: { status: 400 | 409; error: string } | null = null;
  const order = await store.updateOrder(userId, orderId, (o) => {
    refused = null;
    if (o.cancelledAt) {
      refused = { status: 409, error: "This order was cancelled, so there is nothing to split." };
      return false;
    }
    if (o.split?.people.some((p) => p.paid)) {
      refused = { status: 409, error: "Someone has already paid their share, so the split can't be changed." };
      return false;
    }
    const r = computeSplit(o.lines, spec);
    if (!r.ok) {
      refused = { status: 400, error: r.error };
      return false;
    }
    const s = spec as { mode: "equal" | "items"; assign?: number[][] };
    o.split = {
      mode: s.mode,
      people: r.shares.map((sh) => ({ name: sh.name, amount: sh.amount, paid: false })),
      ...(s.mode === "items" ? { assign: s.assign } : {}),
      at: now,
    };
    return true;
  });
  if (!order) return bad(404, "We couldn't find that order on your account.");
  if (refused) {
    const r = refused as { status: 400 | 409; error: string };
    return bad(r.status, r.error);
  }
  return { ok: true, order };
}

/** Record (or undo) that one person has paid their share. The host does this; no real payment happens in this demo. */
export async function setSharePaid(store: UserStore, userId: string, rawOrderId: unknown, index: unknown, paid: unknown): Promise<SplitSaveResult> {
  const orderId = typeof rawOrderId === "string" ? rawOrderId.trim().toUpperCase() : "";
  if (!ORDER_ID_RE.test(orderId)) return bad(400, "Please give an order id like SR-1234.");
  if (typeof paid !== "boolean" || !Number.isInteger(index)) return bad(400, "Invalid request.");

  let refused: { status: 400 | 409; error: string } | null = null;
  const order = await store.updateOrder(userId, orderId, (o) => {
    refused = null;
    const person = o.split?.people[index as number];
    if (o.cancelledAt || !person) {
      refused = { status: o.cancelledAt ? 409 : 400, error: o.cancelledAt ? "This order was cancelled." : "That person isn't on this split." };
      return false;
    }
    if (person.paid === paid) return false;
    person.paid = paid;
    return true;
  });
  if (!order) return bad(404, "We couldn't find that order on your account.");
  if (refused) {
    const r = refused as { status: 400 | 409; error: string };
    return bad(r.status, r.error);
  }
  return { ok: true, order };
}
