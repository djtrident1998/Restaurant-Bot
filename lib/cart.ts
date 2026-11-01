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
  confirmedVersion: number; // cart version the customer confirmed by pressing the UI button (not the model)
  turn: number; // user-message counter
  readBackTurn: number; // turn in which that read-back happened
}

const g = globalThis as unknown as { __spiceSessions?: Map<string, Session> };
const sessions = (g.__spiceSessions ??= new Map<string, Session>());

function session(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    s = { qty: new Map(), orders: [], version: 0, readBackVersion: -1, confirmedVersion: -1, turn: 0, readBackTurn: -1 };
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

/**
 * Records that the customer pressed the "Yes, place order" button for the CURRENT cart. Only the
 * /api/confirm HTTP route calls this — it is deliberately not exposed as a model tool, so the model
 * cannot confirm on the customer's behalf. Any later cart change invalidates it.
 */
export function userConfirm(sessionId: string): boolean {
  const s = session(sessionId);
  if (s.qty.size === 0) return false;
  s.confirmedVersion = s.version;
  s.readBackVersion = s.version; // the cart panel on screen is the read-back
  return true;
}

export function isUserConfirmed(sessionId: string): boolean {
  const s = session(sessionId);
  return s.qty.size > 0 && s.confirmedVersion === s.version;
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

export interface SessionSnapshot {
  qty: [string, number][];
  orders: Order[];
  version: number;
  readBackVersion: number;
  confirmedVersion: number;
  readBackTurn: number;
}

/** Copy of everything a turn can change, so a failed model attempt can be rolled back before another model retries. */
export function snapshotSession(sessionId: string): SessionSnapshot {
  const s = session(sessionId);
  return {
    qty: [...s.qty],
    orders: [...s.orders],
    version: s.version,
    readBackVersion: s.readBackVersion,
    confirmedVersion: s.confirmedVersion,
    readBackTurn: s.readBackTurn,
  };
}

export function restoreSession(sessionId: string, snap: SessionSnapshot): void {
  const s = session(sessionId);
  s.qty = new Map(snap.qty);
  s.orders = [...snap.orders];
  s.version = snap.version;
  s.readBackVersion = snap.readBackVersion;
  s.confirmedVersion = snap.confirmedVersion;
  s.readBackTurn = snap.readBackTurn;
}

export function resetSession(sessionId: string): void {
  sessions.delete(sessionId);
}
