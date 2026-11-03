import { __testing as userStores, userIdFor, type UserRecord } from "@/lib/auth/store";
import { addDays, todayLocal } from "@/lib/booking";
import { cancelBooking, createBooking } from "@/lib/bookingService";
import { __testing as bookingStores } from "@/lib/bookings/store";
import { blobCas, sameVersion, sdkBackend } from "@/lib/blobCas";
import { checkWindow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const shape = (e?: string) => (!e ? "none" : e.startsWith("W/") ? "weak" : e.startsWith('"') ? "quoted" : "plain");
const short = (e: unknown) => String((e as Error)?.message ?? e).slice(0, 140);

/** Replays the exact sequence behind "We couldn't save your booking" on SCRATCH records (diag/…), never on real data. */
async function deepCheck() {
  const cas = blobCas();
  const users = new userStores.BlobStore(cas, "diag/accounts");
  const bookings = new bookingStores.BlobBookingStore(cas, "diag/bookings");
  const steps: Record<string, unknown> = {};
  const run = async (name: string, fn: () => Promise<unknown>) => {
    const t = Date.now();
    try {
      steps[name] = { ok: true, ms: Date.now() - t, value: await fn() };
    } catch (e) {
      steps[name] = { ok: false, ms: Date.now() - t, error: short(e) };
    }
  };

  const id = userIdFor("storage-self-check@example.invalid");
  const scratch: UserRecord = { id, name: "Self Check", email: "storage-self-check@example.invalid", passwordHash: "x", createdAt: 1, orders: [], bookings: [] };
  const date = addDays(todayLocal(), 3);

  await run("createScratchAccount", async () => (await users.create(scratch)) || "already existed");
  await run("resetScratchAccount", async () => !!(await users.updateUser(id, (u) => { u.orders = []; u.bookings = []; return true; })));
  // the old approach, for comparison: the ETag that came with the READ goes straight to the write
  await run("oldApproachWorks", async () => {
    const g = await sdkBackend.get(`diag/accounts/${id}.json`);
    if (!g) throw new Error("missing");
    await sdkBackend.put(`diag/accounts/${id}.json`, g.text, { etag: g.etag });
    return true;
  });
  let bookingId = "";
  await run("createBooking", async () => {
    const r = await createBooking(bookings, users, { id, name: "Self Check" }, { date, time: "19:00", party: 2, notes: "" });
    if (!r.ok) throw new Error(r.error);
    bookingId = r.booking.id;
    return r.booking.id;
  });
  await run("accountListsBooking", async () => ((await users.findById(id))?.bookings ?? []).some((b) => b.id === bookingId));
  await run("fiveParallelAccountWrites", async () => {
    await Promise.all(Array.from({ length: 5 }, (_, i) => users.addOrder(id, { id: `SR-90${i}0`, total: 1, placedAt: Date.now(), lines: [] })));
    return { expected: 5, actual: (await users.findById(id))?.orders.length };
  });
  await run("cancelBooking", async () => {
    const r = await cancelBooking(bookings, users, id, bookingId);
    if (!r.ok) throw new Error(r.error);
    return r.booking.status;
  });
  const failed = Object.entries(steps).filter(([, v]) => !(v as { ok: boolean }).ok).map(([k]) => k);
  return { steps, failed };
}

// A storage self-check: does a safe, conditional read-modify-write against the real Blob store work? It touches only scratch
// files (diag/…), returns no customer data, and is rate-limited. Add ?deep=1 to replay the booking flow end to end.
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkWindow(`storage-check:${ip}`, 5, 60_000)) return Response.json({ ok: false, error: "Too many checks. Please wait a minute." }, { status: 429 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ ok: true, storage: "not-blob" });
  const headers = { "Cache-Control": "no-store" };

  try {
    if (new URL(req.url).searchParams.get("deep") === "1") {
      const d = await deepCheck();
      return Response.json({ ok: d.failed.length === 0, storage: "blob", deep: true, ...d }, { headers });
    }
    const path = "diag/cas-check.json";
    const writes = await blobCas().update<{ n: number }, number>(path, (cur) => ({ write: true, next: { n: (cur?.n ?? 0) + 1 }, result: (cur?.n ?? 0) + 1 }));
    const h = await sdkBackend.head(path);
    const g = await sdkBackend.get(path);
    return Response.json({ ok: true, storage: "blob", casWorks: true, writes, headEtag: shape(h?.etag), readEtag: shape(g?.etag), versionsAgree: !!(h && g && sameVersion(h.etag, g.etag)) }, { headers });
  } catch (e) {
    return Response.json({ ok: false, storage: "blob", casWorks: false, error: short(e) }, { status: 500, headers });
  }
}
