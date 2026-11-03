import fs from "node:fs";
import path from "node:path";
import { blobCas, makeCas } from "../blobCas";
import type { Booking } from "../booking";

// Bookings are stored one file per day, shared by EVERY customer, because table capacity is shared. Updates are atomic:
// on Vercel Blob they use ETag-conditional writes (a competing write makes the update re-read and decide again), so two
// people can never both take the last table.

export interface BookingStore {
  kind: "blob" | "file" | "memory";
  read(date: string): Promise<Booking[]>;
  /** Run `fn` on the day's bookings; if it asks to write, the (mutated) list is saved atomically. */
  update<T>(date: string, fn: (day: Booking[]) => { write: boolean; result: T }): Promise<T>;
}

// ---------- memory ----------
class MemoryBookingStore implements BookingStore {
  kind = "memory" as const;
  private days: Map<string, Booking[]>;
  constructor() {
    const g = globalThis as unknown as { __spiceBookings?: Map<string, Booking[]> };
    this.days = g.__spiceBookings ??= new Map();
  }
  async read(date: string) {
    return structuredClone(this.days.get(date) ?? []);
  }
  async update<T>(date: string, fn: (day: Booking[]) => { write: boolean; result: T }) {
    const day = structuredClone(this.days.get(date) ?? []);
    const r = fn(day);
    if (r.write) this.days.set(date, day);
    return r.result;
  }
}

// ---------- file (local development) ----------
class FileBookingStore implements BookingStore {
  kind = "file" as const;
  private file = path.join(process.cwd(), ".data", "bookings.json");
  private readAll(): Record<string, Booking[]> {
    try {
      return JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch {
      return {};
    }
  }
  async read(date: string) {
    return this.readAll()[date] ?? [];
  }
  async update<T>(date: string, fn: (day: Booking[]) => { write: boolean; result: T }) {
    const all = this.readAll();
    const day = all[date] ?? [];
    const r = fn(day);
    if (r.write) {
      all[date] = day;
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(all, null, 2));
    }
    return r.result;
  }
}

// ---------- Vercel Blob (production, private) ----------
class BlobBookingStore implements BookingStore {
  kind = "blob" as const;
  private cas: ReturnType<typeof makeCas>;
  constructor(cas: ReturnType<typeof makeCas> = blobCas()) {
    this.cas = cas;
  }
  private pathFor = (date: string) => `bookings/${date}.json`;
  async read(date: string) {
    // Availability display only: a plain read is enough (booking itself re-checks inside the atomic update).
    const r = await this.cas.backend.get(this.pathFor(date));
    return r ? (JSON.parse(r.text) as Booking[]) : [];
  }
  async update<T>(date: string, fn: (day: Booking[]) => { write: boolean; result: T }) {
    // The first booking of a day creates the file; later ones replace it only if it is unchanged since they read it.
    return this.cas.update<Booking[], T>(this.pathFor(date), (cur) => {
      const day = cur ?? [];
      const r = fn(day);
      return { write: r.write, next: day, result: r.result };
    });
  }
}

let store: BookingStore | undefined;
export function getBookingStore(env: NodeJS.ProcessEnv = process.env): BookingStore {
  if (store) return store;
  if (env.BLOB_READ_WRITE_TOKEN) store = new BlobBookingStore();
  else if (env.NODE_ENV === "production" || env.VERCEL) store = new MemoryBookingStore();
  else store = new FileBookingStore();
  return store;
}

export const __testing = { MemoryBookingStore, BlobBookingStore };
