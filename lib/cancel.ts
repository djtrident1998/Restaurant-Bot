import type { OrderRecord, UserStore } from "./auth/store";

// Cancel + refund rules live in code, not in the AI: the model can never cancel or refund anything. A customer cancels
// their OWN order, from a button, within a short window after placing it (food is being prepared after that), and
// always gets the FULL total back. No online payment exists in this demo, so the refund is recorded, not transferred.

export const DEFAULT_CANCEL_WINDOW_MIN = 10;

export function cancelWindowMs(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number.parseInt(env.CANCEL_WINDOW_MINUTES ?? "", 10);
  return (Number.isFinite(n) ? Math.min(Math.max(n, 0), 24 * 60) : DEFAULT_CANCEL_WINDOW_MIN) * 60_000;
}

export const ORDER_ID_RE = /^SR-\d{4}$/i;

export type Eligibility = { ok: true; msLeft: number } | { ok: false; reason: "cancelled" | "window"; message: string };

export function cancelEligibility(order: Pick<OrderRecord, "placedAt" | "cancelledAt">, now = Date.now(), windowMs = cancelWindowMs()): Eligibility {
  if (order.cancelledAt) return { ok: false, reason: "cancelled", message: "This order has already been cancelled." };
  const msLeft = order.placedAt + windowMs - now;
  if (msLeft <= 0)
    return {
      ok: false,
      reason: "window",
      message: `Orders can only be cancelled within ${Math.round(windowMs / 60_000)} minutes of placing them, and the kitchen has already started on this one.`,
    };
  return { ok: true, msLeft };
}

export const refundRefFor = (orderId: string) => `RF-${orderId.replace(/^SR-/i, "")}`;

export type CancelResult =
  | { ok: true; order: OrderRecord; refund: NonNullable<OrderRecord["refund"]> }
  | { ok: false; status: 400 | 404 | 409; error: string };

/**
 * Cancel one of the signed-in customer's own orders. The caller passes the user id from the verified session; someone
 * else's order id is simply "not found". The decision is made inside the store's atomic update, so two quick clicks
 * (or two tabs) can only ever produce ONE cancellation and ONE refund.
 */
export async function cancelOrder(store: UserStore, userId: string, rawOrderId: unknown, now = Date.now(), windowMs = cancelWindowMs()): Promise<CancelResult> {
  const orderId = typeof rawOrderId === "string" ? rawOrderId.trim().toUpperCase() : "";
  if (!ORDER_ID_RE.test(orderId)) return { ok: false, status: 400, error: "Please give an order id like SR-1234." };

  let refused: Eligibility | null = null;
  const order = await store.updateOrder(userId, orderId, (o) => {
    const e = cancelEligibility(o, now, windowMs);
    if (!e.ok) {
      refused = e;
      return false;
    }
    refused = null;
    o.cancelledAt = now;
    o.refund = { amount: o.total, ref: refundRefFor(o.id), at: now };
    delete o.split; // a cancelled order has nothing left to divide
    return true;
  });
  if (!order) return { ok: false, status: 404, error: "We couldn't find that order on your account." };
  if (refused) return { ok: false, status: 409, error: (refused as Extract<Eligibility, { ok: false }>).message };
  return { ok: true, order, refund: order.refund! };
}

/**
 * Chat reply to a cancel request. Never cancels by itself: it explains the rule and, when the order is still
 * cancellable, offers a button (the same two-tap flow as the account page). No AI call, no tokens.
 */
export async function handleCancelIntent(
  store: UserStore,
  userId: string | undefined,
  intent: { orderId?: string },
  now = Date.now(),
  windowMs = cancelWindowMs(),
): Promise<{ text: string; outputs: { toolName: string; input: unknown; output: unknown }[] }> {
  if (!userId) return { text: "Please sign in first — cancellations and refunds are for your account's orders.", outputs: [] };
  const orders = (await store.findById(userId))?.orders ?? [];
  const order = intent.orderId ? orders.find((o) => o.id.toUpperCase() === intent.orderId) : [...orders].sort((a, b) => b.placedAt - a.placedAt)[0];
  if (!order) {
    return {
      text: intent.orderId ? `I couldn't find order **${intent.orderId}** on your account.` : "You haven't placed an order yet, so there is nothing to cancel.",
      outputs: [],
    };
  }
  const e = cancelEligibility(order, now, windowMs);
  if (!e.ok) return { text: `Order **${order.id}**: ${e.message}`, outputs: [] };
  const minutesLeft = Math.max(1, Math.ceil(e.msLeft / 60_000));
  return {
    text: `Order **${order.id}** (₹${order.total}) can still be cancelled — about ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"} left. Cancelling refunds the **full ₹${order.total}**. Tap the button below to confirm.`,
    outputs: [{ toolName: "cancel_offer", input: { orderId: order.id }, output: { ok: true, orderId: order.id, total: order.total, minutesLeft } }],
  };
}

// ---- chat: "cancel my order", "cancel order SR-1234", "I want a refund" ----

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' -]/g, " ").replace(/\s+/g, " ").trim();
const CANCEL_RE = /^(?:(?:please|can you|could you|i want to|i'd like to|i would like to|i need to|i wanna)\s+)*(?:cancel|refund)(?: (?:my|the|this|that|last|latest|recent|previous))* (?:order(?: (sr-\d{4}))?|(sr-\d{4}))(?: (?:please|now))?$/;
const REFUND_RE = /^(?:i (?:want|need) (?:a )?refund|refund me|get (?:a )?refund|(?:i want to|i'd like to) (?:get|have) (?:my money back|a refund))(?: (?:for|of) (?:my |the )?(?:order )?(sr-\d{4}))?$/;

/** Recognises a cancel / refund request. Strict, whole-message matching so ordinary questions never trigger it. */
export function detectCancelIntent(text: string): { orderId?: string } | null {
  const t = norm(text);
  if (!t || t.length > 80) return null;
  const m = t.match(CANCEL_RE) ?? t.match(REFUND_RE);
  if (!m) return null;
  const id = m[1] ?? m[2];
  return id ? { orderId: id.toUpperCase() } : {};
}
