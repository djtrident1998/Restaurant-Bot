import { blobCas, makeCas } from "./blobCas";

// A shared DAILY budget, used as the hard ceiling on calls to the paid model. The in-memory rate limits are per server
// instance (each Vercel instance has its own memory), so under heavy traffic they multiply; this counter lives in the
// Blob store, so every instance shares it. Updates use ETag conditional writes, so concurrent requests can't both
// take the last slot. It FAILS CLOSED: if the store can't be reached the paid model is simply not used.

export interface CounterStore {
  /** Atomically add one to today's counter for `key` if it is below `limit`. Returns whether the slot was granted. */
  take(key: string, limit: number): Promise<boolean>;
}

export const dayKey = (name: string, now = Date.now()) => `${name}-${new Date(now).toISOString().slice(0, 10)}`;

export class MemoryCounter implements CounterStore {
  private counts = new Map<string, number>();
  async take(key: string, limit: number) {
    const n = this.counts.get(key) ?? 0;
    if (n >= limit) return false;
    this.counts.set(key, n + 1);
    return true;
  }
}

export class BlobCounter implements CounterStore {
  private cas: ReturnType<typeof makeCas>;
  constructor(cas: ReturnType<typeof makeCas> = blobCas()) {
    this.cas = cas;
  }
  async take(key: string, limit: number) {
    try {
      // Atomic read-increment-write (retried if another request got in first); a missing file means "first call of the day".
      return await this.cas.update<{ n: number }, boolean>(`budget/${key}.json`, (cur) => {
        const n = cur?.n ?? 0;
        if (n >= limit) return { write: false, result: false };
        return { write: true, next: { n: n + 1 }, result: true };
      });
    } catch (e) {
      console.error("[budget] could not update the shared counter (paid model stays off)", String(e).slice(0, 160));
      return false; // fail closed
    }
  }
}

let shared: CounterStore | undefined;
export function getCounter(env: NodeJS.ProcessEnv = process.env): CounterStore {
  return (shared ??= env.BLOB_READ_WRITE_TOKEN ? new BlobCounter() : new MemoryCounter());
}

/** Take one slot from today's shared budget named `name`. A limit of 0 always refuses. */
export async function takeDaily(name: string, limit: number, store: CounterStore = getCounter(), now = Date.now()): Promise<boolean> {
  if (limit <= 0) return false;
  return store.take(dayKey(name, now), limit);
}
