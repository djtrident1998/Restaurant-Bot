// Deterministic ordering: the buttons (Add to cart, Checkout, Yes place order) are answered by code, not by the AI.
// Same guarded tool functions as the model uses, so totals and the confirm-button rule are unchanged — but these
// steps are instant, cost no AI quota and keep working when every AI provider is rate-limited.
import { MENU } from "./menu";
import { viewCart } from "./cart";
import { addToCartTool, getCartTool, placeOrderTool } from "./tools";
import { CHECKOUT_TEXT, CONFIRM_TEXT } from "./chatMessages";

export type OrderIntent = { type: "add"; itemId: string; name: string; qty: number } | { type: "checkout" } | { type: "confirm" } | null;

export interface StaticOutput {
  toolName: string;
  input: unknown;
  output: unknown;
}

const BY_NAME = new Map(MENU.map((i) => [i.name.toLowerCase(), i]));

export function detectOrderIntent(text: string): OrderIntent {
  const t = text.trim();
  if (t === CHECKOUT_TEXT) return { type: "checkout" };
  if (t === CONFIRM_TEXT) return { type: "confirm" };
  const m = t.match(/^add (\d{1,2}) (.+) to my cart$/i);
  if (m) {
    const item = BY_NAME.get(m[2].trim().toLowerCase());
    if (item) return { type: "add", itemId: item.id, name: item.name, qty: Number(m[1]) };
  }
  return null;
}

const bullets = (cart: { lines: { qty: number; name: string; lineTotal: number }[] }) =>
  cart.lines.map((l) => `- ${l.qty} × ${l.name} — ₹${l.lineTotal}`).join("\n");

export function handleOrderIntent(sessionId: string, intent: NonNullable<OrderIntent>): { text: string; outputs: StaticOutput[] } {
  if (intent.type === "add") {
    const r = addToCartTool(sessionId, { itemId: intent.itemId, qty: intent.qty });
    if (!r.ok) return { text: `Sorry — ${r.error}`, outputs: [] };
    return { text: `Added ${intent.qty} × **${intent.name}** to your order (₹${r.line.lineTotal}). Your total is now **₹${r.cart.total}**.\n\nWould you like anything else, or shall we check out?`, outputs: [] };
  }

  if (intent.type === "checkout") {
    const r = getCartTool(sessionId); // marks the cart as read back
    if (!r.ok || r.cart.lines.length === 0) return { text: "Your order is empty. Choose a course and add a dish to begin.", outputs: [] };
    return {
      text: `Here is your order:\n\n${bullets(r.cart)}\n\n**Total: ₹${r.cart.total}**\n\nShall I place this order? Please tap the “Yes, place order” button to confirm.`,
      outputs: [],
    };
  }

  // confirm: only succeeds if the customer pressed the button (server-recorded consent for this exact cart).
  const r = placeOrderTool(sessionId, { confirmed: true });
  if (r.ok) {
    return {
      text: `Your order is placed. Your order ID is **${r.orderId}**. Thank you for dining with Spice Route.`,
      outputs: [{ toolName: "place_order", input: { confirmed: true }, output: r }],
    };
  }
  if (viewCart(sessionId).lines.length === 0) return { text: "Your order is empty, so there is nothing to place.", outputs: [] };
  return { text: "To place the order, please tap the “Yes, place order” button. I can only submit it from that button.", outputs: [] };
}
