import { tool } from "ai";
import { z } from "zod";
import { CATEGORIES, getItem, searchMenu, type MenuItem } from "./menu";
import { addLine, checkout, findOrder, isUserConfirmed, lineQty, markReadBack, viewCart } from "./cart";

export const MAX_QTY_PER_LINE = 20;
const POPULAR_IDS = ["st-01", "vm-02", "nv-01", "rb-01"];

export const searchMenuSchema = z.object({
  query: z.string().max(200).default("").describe("Dish name or keywords, e.g. 'paneer tikka'. Empty to list by filters only."),
  filters: z
    .object({
      veg: z.boolean().optional().describe("true = vegetarian only, false = non-vegetarian only"),
      vegan: z.boolean().optional().describe("true = vegan only (no dairy/egg)"),
      maxPrice: z.number().positive().optional().describe("Max price in INR"),
      category: z.enum(CATEGORIES).optional(),
      maxSpice: z.number().int().min(0).max(3).optional().describe("0 mild … 3 very hot"),
      excludeAllergen: z.string().max(30).optional().describe("e.g. nuts, dairy, gluten, fish, egg"),
    })
    .default({}),
});

export const addToCartSchema = z.object({
  itemId: z.string().min(1).describe("Menu item id from search_menu, e.g. 'st-01'"),
  qty: z.number().int().min(1).max(MAX_QTY_PER_LINE).default(1),
});

export const getCartSchema = z.object({});

export const placeOrderSchema = z.object({
  confirmed: z.boolean().describe("true ONLY after the customer explicitly said yes to the read-back of items and total"),
});

export const orderStatusSchema = z.object({ orderId: z.string().min(1).max(30) });

type Err = { ok: false; error: string };
const err = (error: string): Err => ({ ok: false, error });

function present(i: MenuItem) {
  return { id: i.id, name: i.name, description: i.description, category: i.category, price: i.price, veg: i.veg, spice: i.spice, allergens: i.allergens };
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

export function placeOrderTool(sessionId: string, raw: unknown) {
  const p = placeOrderSchema.safeParse(raw);
  if (!p.success) return err(`Invalid arguments: ${p.error.issues.map((i) => i.message).join("; ")}`);
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

// ---- AI SDK bindings ----

export function buildTools(sessionId: string) {
  return {
    search_menu: tool({
      description: "Search the Spice Route menu. The ONLY source of dishes, prices, spice levels and allergens.",
      inputSchema: searchMenuSchema,
      execute: async (args) => searchMenuTool(args),
    }),
    add_to_cart: tool({
      description: "Add a menu item to the customer's cart. Returns the line total and cart total computed by the system.",
      inputSchema: addToCartSchema,
      execute: async (args) => addToCartTool(sessionId, args),
    }),
    get_cart: tool({
      description: "Read the cart (lines and grand total). Use it for the read-back before placing an order.",
      inputSchema: getCartSchema,
      execute: async () => getCartTool(sessionId),
    }),
    place_order: tool({
      description: "Place the order. Refused unless confirmed=true AND the customer pressed the 'Yes, place order' button for the current cart.",
      inputSchema: placeOrderSchema,
      execute: async (args) => placeOrderTool(sessionId, args),
    }),
    order_status: tool({
      description: "Look up the status of a previously placed order by id.",
      inputSchema: orderStatusSchema,
      execute: async (args) => orderStatusTool(sessionId, args),
    }),
  };
}
