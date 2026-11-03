import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { del } from "@vercel/blob";
import { blobCas, makeCas } from "../blobCas";
import type { BookingRef } from "../booking";

export interface OrderFeedback {
  rating: number; // 1-5 stars
  comment: string; // optional, <= 500 chars; always rendered as plain text
  at: number;
}

export interface OrderRecord {
  id: string;
  total: number;
  placedAt: number;
  lines: { name: string; qty: number; lineTotal: number }[];
  feedback?: OrderFeedback;
  /** Set when the customer cancelled within the cancellation window. */
  cancelledAt?: number;
  /** Refund recorded for a cancelled order (always the full order total; see lib/cancel.ts). */
  refund?: { amount: number; ref: string; at: number };
  /** Delivery, or dining (optionally tied to a table booking). Older orders have no value and count as delivery. */
  service?: { type: "delivery" | "dine-in"; bookingId?: string };
  /** Group order: how the bill is divided between people (see lib/split.ts). Amounts always add up to `total`. */
  split?: { mode: "equal" | "items"; people: { name: string; amount: number; paid: boolean }[]; assign?: number[][]; at: number };
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: number;
  orders: OrderRecord[];
  /** Allergen Shield: dietary needs applied across the app (see lib/profile.ts). */
  profile?: { vegOnly: boolean; avoid: string[] };
  /** The customer's table bookings (a copy for the "Your bookings" list; the shared day files are the authority). */
  bookings?: BookingRef[];
}

export interface UserStore {
  /** "blob" is durable; "file" is local dev; "memory" is NOT durable (resets on restart/cold start). */
  kind: "blob" | "file" | "memory";
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  /** false if an account with this email already exists. */
  create(user: UserRecord): Promise<boolean>;
  addOrder(userId: string, order: OrderRecord): Promise<void>;
  /** Save (or replace) the rating for one of THIS user's orders. false if the user or order doesn't exist. */
  setFeedback(userId: string, orderId: string, feedback: OrderFeedback): Promise<boolean>;
  /**
   * Atomically change one of THIS user's orders: `change` receives the freshly read order, mutates it, and returns
   * true to save (false = leave it as is). On Blob it is re-run on a fresh read if another write got in between, so
   * a decision like "cancel only if not already cancelled" can't be raced. Returns the order, or null if not found.
   */
  updateOrder(userId: string, orderId: string, change: (order: OrderRecord) => boolean): Promise<OrderRecord | null>;
  /** Atomically change the account record itself (same rules as updateOrder). Returns the record, or null if not found. */
  updateUser(userId: string, change: (user: UserRecord) => boolean): Promise<UserRecord | null>;
  /** Permanently remove the account and everything stored with it. Returns false if there was no such account. */
  deleteUser(userId: string): Promise<boolean>;
}

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
/** Deterministic account id from the email, so lookups need no index. */
export const userIdFor = (email: string) => createHash("sha256").update(normalizeEmail(email)).digest("hex").slice(0, 32);

// ---------- memory ----------
class MemoryStore implements UserStore {
  kind = "memory" as const;
  private users: Map<string, UserRecord>;
  constructor() {
    const g = globalThis as unknown as { __spiceUsers?: Map<string, UserRecord> };
    this.users = g.__spiceUsers ??= new Map();
  }
  async findById(id: string) {
    return this.users.get(id) ?? null;
  }
  async findByEmail(email: string) {
    return this.findById(userIdFor(email));
  }
  async create(user: UserRecord) {
    if (this.users.has(user.id)) return false;
    this.users.set(user.id, user);
    return true;
  }
  async addOrder(userId: string, order: OrderRecord) {
    this.users.get(userId)?.orders.push(order);
  }
  async setFeedback(userId: string, orderId: string, feedback: OrderFeedback) {
    const o = this.users.get(userId)?.orders.find((x) => x.id === orderId);
    if (!o) return false;
    o.feedback = feedback;
    return true;
  }
  async updateOrder(userId: string, orderId: string, change: (order: OrderRecord) => boolean) {
    const o = this.users.get(userId)?.orders.find((x) => x.id === orderId);
    if (!o) return null;
    change(o);
    return o;
  }
  async updateUser(userId: string, change: (user: UserRecord) => boolean) {
    const u = this.users.get(userId);
    if (!u) return null;
    change(u);
    return u;
  }
  async deleteUser(userId: string) {
    return this.users.delete(userId);
  }
}

// ---------- file (local development only) ----------
class FileStore implements UserStore {
  kind = "file" as const;
  private file = path.join(process.cwd(), ".data", "users.json");
  private read(): Record<string, UserRecord> {
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      return {};
    }
  }
  private write(db: Record<string, UserRecord>) {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file, JSON.stringify(db, null, 2));
  }
  async findById(id: string) {
    return this.read()[id] ?? null;
  }
  async findByEmail(email: string) {
    return this.findById(userIdFor(email));
  }
  async create(user: UserRecord) {
    const db = this.read();
    if (db[user.id]) return false;
    db[user.id] = user;
    this.write(db);
    return true;
  }
  async addOrder(userId: string, order: OrderRecord) {
    const db = this.read();
    db[userId]?.orders.push(order);
    this.write(db);
  }
  async setFeedback(userId: string, orderId: string, feedback: OrderFeedback) {
    const db = this.read();
    const o = db[userId]?.orders.find((x) => x.id === orderId);
    if (!o) return false;
    o.feedback = feedback;
    this.write(db);
    return true;
  }
  async updateOrder(userId: string, orderId: string, change: (order: OrderRecord) => boolean) {
    const db = this.read();
    const o = db[userId]?.orders.find((x) => x.id === orderId);
    if (!o) return null;
    if (change(o)) this.write(db);
    return o;
  }
  async updateUser(userId: string, change: (user: UserRecord) => boolean) {
    const db = this.read();
    const u = db[userId];
    if (!u) return null;
    if (change(u)) this.write(db);
    return u;
  }
  async deleteUser(userId: string) {
    const db = this.read();
    if (!db[userId]) return false;
    delete db[userId];
    this.write(db);
    return true;
  }
}

// ---------- Vercel Blob (production, private) ----------
// Every change goes through the shared compare-and-swap helper (lib/blobCas.ts): the file is re-read and the change re-applied
// if anything else touched it in between, and a stale read is never written back.
class BlobStore implements UserStore {
  kind = "blob" as const;
  private cas: ReturnType<typeof makeCas>;
  private prefix: string;
  /** `prefix` is only changed by the storage self-check, which works on scratch records, never on real accounts. */
  constructor(cas: ReturnType<typeof makeCas> = blobCas(), prefix = "accounts") {
    this.cas = cas;
    this.prefix = prefix;
  }
  private pathFor = (id: string) => `${this.prefix}/${id}.json`;

  async findById(id: string) {
    // A plain read (no version lookup) keeps page loads fast; writes below re-read with their own version check.
    const r = await this.cas.backend.get(this.pathFor(id));
    return r ? (JSON.parse(r.text) as UserRecord) : null;
  }
  async findByEmail(email: string) {
    return this.findById(userIdFor(email));
  }
  async create(user: UserRecord) {
    try {
      await this.cas.backend.put(this.pathFor(user.id), JSON.stringify(user), { etag: null }); // fails if the account already exists
      return true;
    } catch (e) {
      if (/already exists|exists/i.test(String((e as Error).message))) return false;
      throw e;
    }
  }
  async addOrder(userId: string, order: OrderRecord) {
    await this.cas.update<UserRecord, void>(this.pathFor(userId), (u) => {
      if (!u) return { write: false, result: undefined };
      u.orders.push(order);
      return { write: true, next: u, result: undefined };
    });
  }
  async setFeedback(userId: string, orderId: string, feedback: OrderFeedback) {
    return this.cas.update<UserRecord, boolean>(this.pathFor(userId), (u) => {
      const o = u?.orders.find((x) => x.id === orderId);
      if (!u || !o) return { write: false, result: false };
      o.feedback = feedback;
      return { write: true, next: u, result: true };
    });
  }
  async updateOrder(userId: string, orderId: string, change: (order: OrderRecord) => boolean) {
    return this.cas.update<UserRecord, OrderRecord | null>(this.pathFor(userId), (u) => {
      const o = u?.orders.find((x) => x.id === orderId);
      if (!u || !o) return { write: false, result: null };
      return { write: change(o), next: u, result: o };
    });
  }
  async updateUser(userId: string, change: (user: UserRecord) => boolean) {
    return this.cas.update<UserRecord, UserRecord | null>(this.pathFor(userId), (u) => {
      if (!u) return { write: false, result: null };
      return { write: change(u), next: u, result: u };
    });
  }
  async deleteUser(userId: string) {
    if (!(await this.findById(userId))) return false;
    await del(this.pathFor(userId));
    return true;
  }
}

let store: UserStore | undefined;

export function getStore(env: NodeJS.ProcessEnv = process.env): UserStore {
  if (store) return store;
  if (env.BLOB_READ_WRITE_TOKEN) store = new BlobStore();
  else if (env.NODE_ENV === "production" || env.VERCEL) store = new MemoryStore();
  else store = new FileStore();
  return store;
}

export const __testing = { MemoryStore, BlobStore };
