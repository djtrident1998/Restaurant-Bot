import { tool } from "ai";
import { z } from "zod";
import { CATEGORIES, getItem, isVegan, searchMenu, type MenuItem } from "./menu";
import { addLine, checkout, findOrder, isUserConfirmed, lineQty, markReadBack, viewCart } from "./cart";

export const MAX_QTY_PER_LINE = 20;
const POPULAR_IDS = ["st-01", "vm-02", "nv-01", "rb-01"];

// Descriptions are kept short on purpose: the tool definitions are re-sent on EVERY model call.
export const searchMenuSchema = z.object({
  query: z.string().max(200).default("").describe("dish name/keywords; empty = filters only"),
  filters: z
    .object({
      veg: z.boolean().optional().describe("true veg only, false non-veg only"),
      vegan: z.boolean().optional(),
      maxPrice: z.number().positive().optional().describe("INR"),
      category: z.enum(CATEGORIES).optional(),
      maxSpice: z.number().int().min(0).max(3).optional().describe("0 mild..3 hot"),
      excludeAllergen: z.string().max(30).optional().describe("nuts|dairy|gluten|fish|egg"),
    })
    .default({}),
});

export const addToCartSchema = z.object({
  itemId: z.string().min(1).describe("id from search_menu"),
  qty: z.number().int().min(1).max(MAX_QTY_PER_LINE).default(1),
});

export const getCartSchema = z.object({});

export const placeOrderSchema = z.object({
  confirmed: z.boolean().describe("true only when the customer's button-press message arrives"),
});

export const orderStatusSchema = z.object({ orderId: z.string().min(1).max(30) });

type Err = { ok: false; error: string };
const err = (error: string): Err => ({ ok: false, error });

function present(i: MenuItem) {
  return { id: i.id, name: i.name, description: i.description, category: i.category, price: i.price, veg: i.veg, spice: i.spice, allergens: i.allergens, image: i.image };
}

// ---- pure implementations (unit-testable; args are validated with Zod) ----

export function searchMenuTool(raw: unknown) {
  const p = searchMenuSchema.safeParse(raw);
  if (!p.success) return err(`Invalid arguments: ${p.error.issues.map((i) => i.message).join("; ")}`);
  const items = searchMenu(p.data.query, p.data.filters).map(present);
  if (items.length === 0) {
    // Honest "no" made grounded in code: hand the model real alternatives so it never has to invent any.
    const alternatives = POPULAR_IDS.map((id) => getItem(id)).filter((i): i is MenuItem => !!i).map(present);
    return {
      ok: true as const,
      count: 0,
      items: [],
      note: "No menu item matches. Tell the customer we don't have it. Only suggest dishes from `alternatives` (use their exact names and prices); never mention any other dish.",
      alternatives,
    };
  }
  return { ok: true as const, count: items.length, items };
}

export function addToCartTool(sessionId: string, raw: unknown) {
  const p = addToCartSchema.safeParse(raw);
  if (!p.success) return err(`Invalid arguments: ${p.error.issues.map((i) => i.message).join("; ")}`);
  const item = getItem(p.data.itemId);
  if (!item) return err(`No menu item with id '${p.data.itemId}'. Use search_menu to find valid ids.`);
  if (lineQty(sessionId, item.id) + p.data.qty > MAX_QTY_PER_LINE)
    return err(`Maximum ${MAX_QTY_PER_LINE} of one item per order.`);
  addLine(sessionId, item.id, p.data.qty);
  const cart = viewCart(sessionId);
  const line = cart.lines.find((l) => l.itemId === item.id)!;
  return { ok: true as const, added: { name: item.name, qty: p.data.qty }, line, cart };
}

export function getCartTool(sessionId: string, raw: unknown = {}) {
  const p = getCartSchema.safeParse(raw ?? {});
  if (!p.success) return err("Invalid arguments.");
  markReadBack(sessionId);
  return { ok: true as const, cart: viewCart(sessionId) };
}

export const SIGN_IN_REQUIRED =
  "Order NOT placed: the customer must sign in or create an account before ordering. Tell them to use Sign in / Create account (top right) — their cart will be kept — and then check out.";

/** Deny by default: an order can only be placed for a signed-in customer (`signedIn` comes from the verified session cookie). */
export function placeOrderTool(sessionId: string, raw: unknown, opts: { signedIn?: boolean } = {}) {
  const p = placeOrderSchema.safeParse(raw);
  if (!p.success) return err(`Invalid arguments: ${p.error.issues.map((i) => i.message).join("; ")}`);
  if (!opts.signedIn) return err(SIGN_IN_REQUIRED);
  if (!p.data.confirmed)
    return err("Order NOT placed: customer has not confirmed. Read back the cart with get_cart, state the total, and ask for an explicit yes.");
  if (viewCart(sessionId).lines.length === 0) return err("Order NOT placed: the cart is empty.");
  // The real confirmation: set only by the customer pressing the UI button (POST /api/confirm), never by the model.
  if (!isUserConfirmed(sessionId))
    return err("Order NOT placed: the customer has not pressed the 'Yes, place order' button for the current cart. Read the cart back with get_cart, state the exact total, ask 'Shall I place this order?', and tell them to tap the 'Yes, place order' button (typing yes is not enough). Then END your reply.");
  const order = checkout(sessionId);
  return { ok: true as const, orderId: order.id, status: "Received", cart: order.cart };
}

export function orderStatusTool(sessionId: string, raw: unknown) {
  const p = orderStatusSchema.safeParse(raw);
  if (!p.success) return err(`Invalid arguments: ${p.error.issues.map((i) => i.message).join("; ")}`);
  const order = findOrder(sessionId, p.data.orderId);
  if (!order) return err(`No order found with id '${p.data.orderId}'.`);
  const mins = (Date.now() - order.placedAt) / 60000;
  const status = mins < 2 ? "Received" : mins < 15 ? "Preparing" : mins < 30 ? "Out for delivery" : "Delivered";
  return { ok: true as const, orderId: order.id, status, total: order.cart.total, note: "Demo status derived from elapsed time." };
}

// ---- compact model-facing views ----
// The UI keeps the full tool output (menu cards need descriptions). The MODEL gets a terse text view,
// because every tool result is re-sent on every later model call in the turn and in later turns.

export const MODEL_SEARCH_LIMIT = 8;

type Loose = { ok?: boolean; error?: string; [k: string]: unknown };
type CartLike = { lines: { qty: number; name: string; unitPrice: number; lineTotal: number }[]; itemCount: number; total: number };

const cartLine = (c: CartLike) =>
  c.lines.length ? `${c.lines.map((l) => `${l.qty}x ${l.name} @₹${l.unitPrice}=₹${l.lineTotal}`).join("; ")}; TOTAL ₹${c.total} (${c.itemCount} items)` : "cart empty; TOTAL ₹0";

const itemLine = (i: { id: string; name: string; price: number; veg: boolean; spice: number; category: string; allergens: string[] }) =>
  `${i.id}|${i.name}|₹${i.price}|${i.veg ? (isVegan(i as MenuItem) ? "vegan" : "veg") : "non-veg"}|spice${i.spice}|${i.category}|allergens:${i.allergens.join(",") || "none"}`;

export function modelViewSearch(o: Loose): string {
  if (!o.ok) return `Error: ${o.error}`;
  const items = (o.items as Parameters<typeof itemLine>[0][]) ?? [];
  if (items.length === 0) {
    const alts = ((o.alternatives as Parameters<typeof itemLine>[0][]) ?? []).map(itemLine).join("\n");
    return `No match. Say we don't have it; suggest ONLY these (exact names/prices):\n${alts}`;
  }
  const shown = items.slice(0, MODEL_SEARCH_LIMIT).map(itemLine).join("\n");
  return `${items.length} match(es) (id|name|price|diet|spice|category|allergens):\n${shown}${items.length > MODEL_SEARCH_LIMIT ? `\n(+${items.length - MODEL_SEARCH_LIMIT} more; narrow with filters)` : ""}`;
}

export function modelViewCart(o: Loose): string {
  if (!o.ok) return `Error: ${o.error}`;
  return `Cart: ${cartLine(o.cart as CartLike)}`;
}

export function modelViewAdd(o: Loose): string {
  if (!o.ok) return `Error: ${o.error}`;
  const a = o.added as { name: string; qty: number };
  const line = o.line as { lineTotal: number };
  return `Added ${a.qty}x ${a.name} (line ₹${line.lineTotal}). Cart: ${cartLine(o.cart as CartLike)}`;
}

export function modelViewOrder(o: Loose): string {
  if (!o.ok) return `Error: ${o.error}`;
  return `Order ${o.orderId} placed (${o.status}). ${cartLine(o.cart as CartLike)}`;
}

export function modelViewStatus(o: Loose): string {
  if (!o.ok) return `Error: ${o.error}`;
  return `Order ${o.orderId}: ${o.status}, total ₹${o.total}`;
}

const asText = (value: string) => ({ type: "text" as const, value });

// ---- AI SDK bindings ----

export function buildTools(sessionId: string, signedIn = false) {
  return {
    search_menu: tool({
      description: "Search the menu. The only source of dishes, prices, spice and allergens.",
      inputSchema: searchMenuSchema,
      execute: async (args) => searchMenuTool(args),
      toModelOutput: ({ output }) => asText(modelViewSearch(output as Loose)),
    }),
    add_to_cart: tool({
      description: "Add an item to the cart; returns system-computed totals.",
      inputSchema: addToCartSchema,
      execute: async (args) => addToCartTool(sessionId, args),
      toModelOutput: ({ output }) => asText(modelViewAdd(output as Loose)),
    }),
    get_cart: tool({
      description: "Read the cart and total (use for the checkout read-back).",
      inputSchema: getCartSchema,
      execute: async () => getCartTool(sessionId),
      toModelOutput: ({ output }) => asText(modelViewCart(output as Loose)),
    }),
    place_order: tool({
      description: "Place the order. Refused unless the customer is signed in and pressed the Yes button for the current cart.",
      inputSchema: placeOrderSchema,
      execute: async (args) => placeOrderTool(sessionId, args, { signedIn }),
      toModelOutput: ({ output }) => asText(modelViewOrder(output as Loose)),
    }),
    order_status: tool({
      description: "Status of a placed order by id.",
      inputSchema: orderStatusSchema,
      execute: async (args) => orderStatusTool(sessionId, args),
      toModelOutput: ({ output }) => asText(modelViewStatus(output as Loose)),
    }),
  };
}
