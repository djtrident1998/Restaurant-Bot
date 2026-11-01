// In-memory per-session cart store (demo scale; resets on cold start).
import { getItem } from "./menu";

export interface CartLine {
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

export interface CartView {
  lines: CartLine[];
  itemCount: number;
  total: number;
}

export interface Order {
  id: string;
  placedAt: number;
  cart: CartView;
}

interface Session {
  qty: Map<string, number>;
  orders: Order[];
  version: number; // bumps on every cart change
  readBackVersion: number; // cart version the customer was last shown via get_cart
  turn: number; // user-message counter
  readBackTurn: number; // turn in which that read-back happened
}

const g = globalThis as unknown as { __spiceSessions?: Map<string, Session> };
const sessions = (g.__spiceSessions ??= new Map<string, Session>());

function session(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    s = { qty: new Map(), orders: [], version: 0, readBackVersion: -1, turn: 0, readBackTurn: -1 };
    sessions.set(id, s);
  }
  return s;
}

// All price math lives here — never in the model.
export function viewCart(sessionId: string): CartView {
  const s = session(sessionId);
  const lines: CartLine[] = [];
  for (const [itemId, qty] of s.qty) {
    const item = getItem(itemId);
    if (!item) continue;
    lines.push({ itemId, name: item.name, unitPrice: item.price, qty, lineTotal: item.price * qty });
  }
  return {
    lines,
    itemCount: lines.reduce((n, l) => n + l.qty, 0),
    total: lines.reduce((n, l) => n + l.lineTotal, 0),
  };
}

export function addLine(sessionId: string, itemId: string, qty: number): void {
  const s = session(sessionId);
  s.qty.set(itemId, (s.qty.get(itemId) ?? 0) + qty);
  s.version++;
}

export function lineQty(sessionId: string, itemId: string): number {
  return session(sessionId).qty.get(itemId) ?? 0;
}

/** Call once per incoming user message. */
export function beginTurn(sessionId: string): void {
  session(sessionId).turn++;
}

export function markReadBack(sessionId: string): void {
  const s = session(sessionId);
  s.readBackVersion = s.version;
  s.readBackTurn = s.turn;
}

// The customer can only have seen the read-back if it was shown in an EARLIER turn than the one
// asking to place the order, and the cart hasn't changed since.
export function isReadBackCurrent(sessionId: string): boolean {
  const s = session(sessionId);
  return s.readBackVersion === s.version && s.readBackTurn < s.turn;
}

export function checkout(sessionId: string): Order {
  const s = session(sessionId);
  const order: Order = {
    id: `SR-${Math.floor(1000 + Math.random() * 9000)}`,
    placedAt: Date.now(),
    cart: viewCart(sessionId),
  };
  s.orders.push(order);
  s.qty.clear();
  s.version++;
  return order;
}

export function findOrder(sessionId: string, orderId: string): Order | undefined {
  return session(sessionId).orders.find((o) => o.id.toLowerCase() === orderId.trim().toLowerCase());
}

export function resetSession(sessionId: string): void {
  sessions.delete(sessionId);
}
