import fs from "node:fs";
import path from "node:path";
import { get, put } from "@vercel/blob";
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
  private pathFor = (date: string) => `bookings/${date}.json`;
  private async load(date: string): Promise<{ day: Booking[]; etag: string | null }> {
    const res = await get(this.pathFor(date), { access: "private", useCache: false });
    if (!res || res.statusCode !== 200) return { day: [], etag: null };
    return { day: JSON.parse(await new Response(res.stream).text()) as Booking[], etag: res.blob.etag };
  }
  async read(date: string) {
    return (await this.load(date)).day;
  }
  async update<T>(date: string, fn: (day: Booking[]) => { write: boolean; result: T }) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const { day, etag } = await this.load(date);
      const r = fn(day);
      if (!r.write) return r.result;
      try {
        await put(this.pathFor(date), JSON.stringify(day), {
          access: "private",
          contentType: "application/json",
          addRandomSuffix: false,
          // first booking of the day creates the file (fails if someone else just did); later ones need an unchanged ETag
          allowOverwrite: etag !== null,
          ...(etag ? { ifMatch: etag } : {}),
        });
        return r.result;
      } catch (e) {
        if (attempt === 5) throw e; // lost the race 6 times, or storage is down
      }
    }
    throw new Error("unreachable");
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

export const __testing = { MemoryBookingStore };
