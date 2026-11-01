import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";

export interface OrderRecord {
  id: string;
  total: number;
  placedAt: number;
  lines: { name: string; qty: number; lineTotal: number }[];
}

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: number;
  orders: OrderRecord[];
}

export interface UserStore {
  /** "blob" is durable; "file" is local dev; "memory" is NOT durable (resets on restart/cold start). */
  kind: "blob" | "file" | "memory";
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  /** false if an account with this email already exists. */
  create(user: UserRecord): Promise<boolean>;
  addOrder(userId: string, order: OrderRecord): Promise<void>;
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
}

// ---------- Vercel Blob (production, private) ----------
class BlobStore implements UserStore {
  kind = "blob" as const;
  private pathFor = (id: string) => `accounts/${id}.json`;

  private async read(id: string): Promise<{ user: UserRecord; etag: string } | null> {
    const res = await get(this.pathFor(id), { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return null;
    const text = await new Response(res.stream).text();
    return { user: JSON.parse(text) as UserRecord, etag: res.blob.etag };
  }
  async findById(id: string) {
    return (await this.read(id))?.user ?? null;
  }
  async findByEmail(email: string) {
    return this.findById(userIdFor(email));
  }
  async create(user: UserRecord) {
    try {
      await put(this.pathFor(user.id), JSON.stringify(user), {
        access: "private",
        contentType: "application/json",
        addRandomSuffix: false,
        allowOverwrite: false, // fails if the account already exists
      });
      return true;
    } catch (e) {
      if (/already exists|exists/i.test(String((e as Error).message))) return false;
      throw e;
    }
  }
  async addOrder(userId: string, order: OrderRecord) {
    // Optimistic concurrency: write only if nobody changed the record since we read it; retry a few times.
    for (let attempt = 0; attempt < 4; attempt++) {
      const cur = await this.read(userId);
      if (!cur) return;
      cur.user.orders.push(order);
      try {
        await put(this.pathFor(userId), JSON.stringify(cur.user), {
          access: "private",
          contentType: "application/json",
          addRandomSuffix: false,
          allowOverwrite: true,
          ifMatch: cur.etag,
        });
        return;
      } catch (e) {
        if (attempt === 3) throw e;
      }
    }
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

export const __testing = { MemoryStore };
