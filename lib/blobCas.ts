import { BlobNotFoundError, get, head, put } from "@vercel/blob";

// Safe "read, change, write back" for JSON files in Vercel Blob (compare-and-swap). Several parts of the app need it:
// accounts, bookings and the daily budget counter. Each write says "only if nobody changed it since I read it".
//
// Lessons built in (found in production): the version used for the check must be the blob's OWN version from `head()`
// (the API's authoritative ETag, the one the Blob docs say to pass to ifMatch), not whatever ETag header a cached read
// happened to carry; and a read that does not match that version is a STALE copy, which must never be written back
// (that would silently undo someone else's change), so it is re-read after a short pause instead.

export interface CasBackend {
  /** The blob's current version, or null if it doesn't exist. */
  head(path: string): Promise<{ etag: string } | null>;
  /** The blob's content (and the ETag that came with that read), or null if it doesn't exist. */
  get(path: string): Promise<{ text: string; etag: string } | null>;
  /** Write. `etag === null` means "create; fail if it already exists"; otherwise "replace only if still at this version". */
  put(path: string, body: string, opts: { etag: string | null }): Promise<{ etag: string }>;
}

export interface Versioned<T> {
  value: T;
  etag: string;
}

export class StaleReadError extends Error {
  constructor(path: string) {
    super(`Blob read stayed out of date: ${path}`);
    this.name = "StaleReadError";
  }
}

/** Version strings can differ only in form (quotes, weak marker); compare the substance. */
export const sameVersion = (a: string, b: string) => a.replace(/^W\//, "").replace(/"/g, "") === b.replace(/^W\//, "").replace(/"/g, "");

export const isPrecondition = (e: unknown) => (e as { name?: string })?.name === "BlobPreconditionFailedError" || /precondition failed|etag mismatch/i.test(String((e as Error)?.message ?? e));
export const isAlreadyExists = (e: unknown) => /already exists/i.test(String((e as Error)?.message ?? e));

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function makeCas(backend: CasBackend, opts: { sleep?: (ms: number) => Promise<void>; readAttempts?: number; writeAttempts?: number } = {}) {
  const sleep = opts.sleep ?? realSleep;
  const readAttempts = opts.readAttempts ?? 4;
  const writeAttempts = opts.writeAttempts ?? 6;

  /** Content + version together. null if missing. Re-reads (with short waits) while the content is a stale copy. */
  async function read<T>(path: string): Promise<Versioned<T> | null> {
    for (let i = 0; i < readAttempts; i++) {
      let meta: { etag: string } | null;
      try {
        meta = await backend.head(path);
      } catch {
        meta = undefined as never; // head unavailable: fall back to the version that came with the read (never worse than before)
      }
      if (meta === null) return null;
      const body = await backend.get(path);
      if (!body) return null;
      if (!meta) return { value: JSON.parse(body.text) as T, etag: body.etag };
      if (body.etag && !sameVersion(meta.etag, body.etag)) {
        if (i < readAttempts - 1) {
          await sleep(200 * (i + 1));
          continue;
        }
        throw new StaleReadError(path);
      }
      return { value: JSON.parse(body.text) as T, etag: meta.etag };
    }
    throw new StaleReadError(path);
  }

  /**
   * Apply `fn` to the current value (null if the file doesn't exist yet) and save the result, atomically. If someone else
   * changed the file in between, the whole thing is re-read and `fn` runs again, so its decision is always made on fresh
   * data. `fn` returns { write: false } to leave the file alone.
   */
  async function update<T, R>(path: string, fn: (current: T | null) => { write: boolean; next?: T; result: R }): Promise<R> {
    let lastError: unknown;
    for (let attempt = 0; attempt < writeAttempts; attempt++) {
      let cur: Versioned<T> | null;
      try {
        cur = await read<T>(path);
      } catch (e) {
        lastError = e;
        if (e instanceof StaleReadError && attempt < writeAttempts - 1) {
          await sleep(150 * (attempt + 1));
          continue;
        }
        throw e;
      }
      const r = fn(cur ? structuredClone(cur.value) : null);
      if (!r.write) return r.result;
      try {
        await backend.put(path, JSON.stringify(r.next), { etag: cur?.etag ?? null });
        return r.result;
      } catch (e) {
        lastError = e;
        if (!isPrecondition(e) && !isAlreadyExists(e)) throw e; // a real failure, not a lost race
        await sleep(40 * (attempt + 1) + Math.floor(Math.random() * 40));
      }
    }
    throw lastError instanceof Error ? lastError : new Error("could not save after several attempts");
  }

  return { read, update, backend };
}

// ---------- the real Vercel Blob backend ----------

export const sdkBackend: CasBackend = {
  async head(path) {
    try {
      return { etag: (await head(path)).etag };
    } catch (e) {
      if (e instanceof BlobNotFoundError) return null;
      throw e;
    }
  },
  async get(path) {
    const r = await get(path, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return { text: await new Response(r.stream).text(), etag: r.blob.etag };
  },
  async put(path, body, { etag }) {
    const r = await put(path, body, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: etag !== null,
      ...(etag ? { ifMatch: etag } : {}),
    });
    return { etag: r.etag };
  },
};

let shared: ReturnType<typeof makeCas> | undefined;
export const blobCas = () => (shared ??= makeCas(sdkBackend));
