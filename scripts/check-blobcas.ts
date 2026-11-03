// Offline test of the shared Blob read-modify-write helper, using a fake Blob that reproduces what went wrong in production
// ("ETag mismatch" on every account save): weak ETags on reads, stale reads, races, a missing head(), real failures.
import { StaleReadError, isAlreadyExists, isPrecondition, makeCas, sameVersion, type CasBackend } from "../lib/blobCas";
import { BlobCounter } from "../lib/budget";
import { __testing as bookingTesting } from "../lib/bookings/store";
import { __testing as userTesting, userIdFor, type UserRecord } from "../lib/auth/store";
import { createBooking, cancelBooking } from "../lib/bookingService";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

class FakeBlob implements CasBackend {
  files = new Map<string, { text: string; version: number; prevText?: string; prevVersion?: number }>();
  weakReads = false; // reads carry W/"…" ETags (as a compressing CDN would send)
  staleReads = 0; // the next N reads return the previous content + version
  headBroken = false;
  headCalls = 0;
  puts = 0;
  failNextPutWith: Error | null = null;
  private tag = (v: number) => `"etag-${v}"`;
  private async tick() {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, Math.random() * 2));
  }
  async head(path: string) {
    this.headCalls++;
    await this.tick();
    if (this.headBroken) throw new Error("head not available");
    const f = this.files.get(path);
    return f ? { etag: this.tag(f.version) } : null;
  }
  async get(path: string) {
    await this.tick();
    const f = this.files.get(path);
    if (!f) return null;
    let text = f.text, version = f.version;
    if (this.staleReads > 0 && f.prevText !== undefined) {
      this.staleReads--;
      text = f.prevText;
      version = f.prevVersion!;
    }
    return { text, etag: this.weakReads ? `W/${this.tag(version)}` : this.tag(version) };
  }
  async put(path: string, body: string, opts: { etag: string | null }) {
    await this.tick();
    this.puts++;
    if (this.failNextPutWith) {
      const e = this.failNextPutWith;
      this.failNextPutWith = null;
      throw e;
    }
    const f = this.files.get(path);
    if (opts.etag === null) {
      if (f) throw new Error("Vercel Blob: This blob already exists, use `allowOverwrite: true` to overwrite it.");
    } else if (!f || this.tag(f.version) !== opts.etag) {
      throw Object.assign(new Error("Vercel Blob: Precondition failed: ETag mismatch."), { name: "BlobPreconditionFailedError" });
    }
    const version = (f?.version ?? 0) + 1;
    this.files.set(path, { text: body, version, prevText: f?.text, prevVersion: f?.version });
    return { etag: this.tag(version) };
  }
}

const noSleep = async () => {};
const inc = (cur: { n: number } | null) => ({ write: true, next: { n: (cur?.n ?? 0) + 1 }, result: (cur?.n ?? 0) + 1 });

(async () => {
  // ---- helpers ----
  check("version comparison ignores quotes and the weak marker", sameVersion('W/"abc"', '"abc"') && sameVersion("abc", '"abc"') && !sameVersion('"abc"', '"abd"'));
  check("recognises the production error", isPrecondition(new Error("Vercel Blob: Precondition failed: ETag mismatch.")) && isPrecondition({ name: "BlobPreconditionFailedError" }) && !isPrecondition(new Error("500 internal")));
  check("recognises create-race error", isAlreadyExists(new Error("This blob already exists")) && !isAlreadyExists(new Error("other")));

  // ---- basics ----
  const b1 = new FakeBlob();
  const c1 = makeCas(b1, { sleep: noSleep });
  check("missing file reads as null", (await c1.read("x.json")) === null);
  check("update on a missing file creates it", (await c1.update<{ n: number }, number>("x.json", inc)) === 1 && JSON.parse(b1.files.get("x.json")!.text).n === 1);
  check("update on an existing file changes it", (await c1.update<{ n: number }, number>("x.json", inc)) === 2 && JSON.parse(b1.files.get("x.json")!.text).n === 2);
  const before = b1.puts;
  check("a no-change update writes nothing", (await c1.update("x.json", () => ({ write: false, result: "left alone" }))) === "left alone" && b1.puts === before);
  const mutated = await c1.update<{ n: number }, number>("x.json", (cur) => { cur!.n = 999; return { write: false, result: cur!.n }; });
  check("the function works on a copy: not writing means nothing changes", mutated === 999 && JSON.parse(b1.files.get("x.json")!.text).n === 2);

  // ---- the production bug: weak ETags on reads ----
  const b2 = new FakeBlob();
  b2.weakReads = true;
  const c2 = makeCas(b2, { sleep: noSleep });
  await c2.update<{ n: number }, number>("acct.json", inc);
  // the OLD approach: pass the ETag that came with the read straight to the write
  const oldWay = async () => { const g = await b2.get("acct.json"); await b2.put("acct.json", g!.text, { etag: g!.etag }); };
  let oldFailed = "";
  try { await oldWay(); } catch (e) { oldFailed = String((e as Error).message); }
  check("the old approach reproduces the production error exactly", /Precondition failed: ETag mismatch/.test(oldFailed));
  check("weak read ETags no longer break saving (version comes from head)", (await c2.update<{ n: number }, number>("acct.json", inc)) === 2 && (await c2.update<{ n: number }, number>("acct.json", inc)) === 3);

  // ---- races: many writers, no lost updates ----
  const b3 = new FakeBlob();
  const c3 = makeCas(b3, { sleep: noSleep, writeAttempts: 60 });
  await Promise.all(Array.from({ length: 12 }, () => c3.update<{ n: number }, number>("count.json", inc)));
  check("12 simultaneous increments all land (no lost updates)", JSON.parse(b3.files.get("count.json")!.text).n === 12);
  const b3b = new FakeBlob();
  const c3b = makeCas(b3b, { sleep: noSleep, writeAttempts: 60 });
  const results = await Promise.all(Array.from({ length: 8 }, () => c3b.update<{ n: number }, number>("fresh.json", inc)));
  check("8 simultaneous creators of a brand-new file: still exactly 8", JSON.parse(b3b.files.get("fresh.json")!.text).n === 8 && new Set(results).size === 8);

  // ---- stale reads must never be written back ----
  const b4 = new FakeBlob();
  const c4 = makeCas(b4, { sleep: noSleep });
  await c4.update<{ n: number }, number>("s.json", inc);
  await c4.update<{ n: number }, number>("s.json", inc); // now has a previous version
  b4.staleReads = 2; // the next two content reads are out of date
  check("a stale read is detected and re-read: the increment is not lost", (await c4.update<{ n: number }, number>("s.json", inc)) === 3 && JSON.parse(b4.files.get("s.json")!.text).n === 3);
  const b5 = new FakeBlob();
  const c5 = makeCas(b5, { sleep: noSleep, readAttempts: 3, writeAttempts: 3 });
  await c5.update<{ n: number }, number>("s.json", inc);
  await c5.update<{ n: number }, number>("s.json", inc);
  b5.staleReads = 1000; // never catches up
  let stale: unknown = null;
  try { await c5.update<{ n: number }, number>("s.json", inc); } catch (e) { stale = e; }
  check("permanently stale: refuses (no silent overwrite)", stale instanceof StaleReadError && JSON.parse(b5.files.get("s.json")!.text).n === 2);

  // ---- head unavailable: falls back to the version that came with the read (never worse than before) ----
  const b6 = new FakeBlob();
  b6.headBroken = true;
  const c6 = makeCas(b6, { sleep: noSleep });
  await c6.update<{ n: number }, number>("h.json", inc);
  check("head unavailable: still works using the read's version", (await c6.update<{ n: number }, number>("h.json", inc)) === 2);
  check("…and a missing file still reads as missing", (await c6.read("nope.json")) === null);

  // ---- real failures are not retried forever ----
  const b7 = new FakeBlob();
  const c7 = makeCas(b7, { sleep: noSleep });
  await c7.update<{ n: number }, number>("e.json", inc);
  b7.failNextPutWith = new Error("500 internal error");
  const putsBefore = b7.puts;
  let failed = false;
  try { await c7.update<{ n: number }, number>("e.json", inc); } catch { failed = true; }
  check("a real storage error is thrown straight away (one attempt)", failed && b7.puts === putsBefore + 1);
  const b8 = new FakeBlob();
  const c8 = makeCas(b8, { sleep: noSleep, writeAttempts: 3 });
  await c8.update<{ n: number }, number>("p.json", inc);
  const realPut = b8.put.bind(b8);
  b8.put = async () => { throw new Error("Vercel Blob: Precondition failed: ETag mismatch."); };
  let gaveUp = "";
  try { await c8.update<{ n: number }, number>("p.json", inc); } catch (e) { gaveUp = String((e as Error).message); }
  b8.put = realPut;
  check("an endless race gives up after the retry limit with the real error", /ETag mismatch/.test(gaveUp));

  // ---- the stores built on it ----
  const mkUser = (email: string): UserRecord => ({ id: userIdFor(email), name: "Blob Tester", email, passwordHash: "x", createdAt: 1, orders: [{ id: "SR-1111", total: 100, placedAt: 5, lines: [{ name: "Dal", qty: 1, lineTotal: 100 }] }] });
  const ub = new FakeBlob();
  ub.weakReads = true; // the production-like condition
  const users = new userTesting.BlobStore(makeCas(ub, { sleep: noSleep, writeAttempts: 40 }));
  const u = mkUser("blob-user@example.com");
  check("account: create, and a second create is refused", (await users.create(u)) === true && (await users.create(u)) === false);
  check("account: read back", (await users.findById(u.id))?.name === "Blob Tester" && (await users.findById("nobody")) === null);
  await users.addOrder(u.id, { id: "SR-2222", total: 50, placedAt: 6, lines: [{ name: "Naan", qty: 1, lineTotal: 50 }] });
  check("account: addOrder works with weak read ETags", (await users.findById(u.id))?.orders.length === 2);
  check("account: setFeedback", (await users.setFeedback(u.id, "SR-1111", { rating: 5, comment: "good", at: 1 })) === true && (await users.findById(u.id))?.orders[0].feedback?.rating === 5);
  check("account: setFeedback on a missing order is false", (await users.setFeedback(u.id, "SR-9999", { rating: 1, comment: "", at: 1 })) === false);
  const upd = await users.updateOrder(u.id, "SR-2222", (o) => { o.cancelledAt = 7; return true; });
  check("account: updateOrder (cancel) saved", upd?.cancelledAt === 7 && (await users.findById(u.id))?.orders[1].cancelledAt === 7);
  check("account: updateOrder with 'no change' leaves it alone", (await users.updateOrder(u.id, "SR-1111", () => false))?.id === "SR-1111");
  check("account: updateUser (profile) saved", (await users.updateUser(u.id, (x) => { x.profile = { vegOnly: true, avoid: ["nuts"] }; return true; }))?.profile?.vegOnly === true && (await users.findById(u.id))?.profile?.avoid[0] === "nuts");
  check("account: updateUser on a missing account is null", (await users.updateUser("ghost", () => true)) === null);
  await Promise.all(Array.from({ length: 6 }, (_, i) => users.addOrder(u.id, { id: `SR-30${i}0`, total: 1, placedAt: 9, lines: [] })));
  check("account: 6 simultaneous orders all saved", (await users.findById(u.id))!.orders.length === 8);

  const cb = new FakeBlob();
  cb.weakReads = true;
  const counter = new BlobCounter(makeCas(cb, { sleep: noSleep, writeAttempts: 60 }));
  const takes = await Promise.all(Array.from({ length: 12 }, () => counter.take("paid-2026-11-03", 5)));
  check("budget counter on Blob: exactly the limit is granted under a race", takes.filter(Boolean).length === 5 && JSON.parse(cb.files.get("budget/paid-2026-11-03.json")!.text).n === 5);
  const broken = new FakeBlob();
  broken.put = async () => { throw new Error("storage down"); };
  const errs = console.error;
  console.error = () => {};
  check("budget counter fails closed when storage is down", (await new BlobCounter(makeCas(broken, { sleep: noSleep })).take("k", 5)) === false);
  console.error = errs;

  // ---- bookings on Blob, with the production-like conditions ----
  const bb = new FakeBlob();
  bb.weakReads = true;
  const bookings = new bookingTesting.BlobBookingStore(makeCas(bb, { sleep: noSleep, writeAttempts: 80 }));
  const ub2 = new FakeBlob();
  ub2.weakReads = true;
  const users2 = new userTesting.BlobStore(makeCas(ub2, { sleep: noSleep, writeAttempts: 40 }));
  const NOW = Date.UTC(2026, 10, 3, 6, 0, 0);
  const racers: UserRecord[] = [];
  for (let i = 0; i < 8; i++) { const r = mkUser(`racer${i}-blob@example.com`); r.orders = []; await users2.create(r); racers.push(r); }
  const first = await createBooking(bookings, users2, { id: racers[0].id, name: "R0" }, { date: "2026-11-10", time: "20:00", party: 2, notes: "hi" }, NOW);
  check("booking on Blob with weak read ETags: saved (this was the production failure)", first.ok && (await users2.findById(racers[0].id))?.bookings?.length === 1, first.ok ? first.booking.id : JSON.stringify(first));
  const race = await Promise.all(racers.slice(1).map((r, i) => createBooking(bookings, users2, { id: r.id, name: `R${i + 1}` }, { date: "2026-11-11", time: "20:00", party: 8 }, NOW)));
  check("Blob: 7 people racing for the one 8-seat table → exactly one booking", race.filter((x) => x.ok).length === 1);
  const winnerIdx = race.findIndex((x) => x.ok);
  check("Blob: the winner's account lists it", (await users2.findById(racers[winnerIdx + 1].id))?.bookings?.length === 1);
  const loserLists = await Promise.all(racers.slice(1).filter((_, i) => i !== winnerIdx).map(async (r) => (await users2.findById(r.id))?.bookings?.length ?? 0));
  check("Blob: the losers' accounts have no booking", loserLists.length === 6 && loserLists.every((n) => n === 0));
  const cancelled = await cancelBooking(bookings, users2, racers[0].id, first.ok ? first.booking.id : "", NOW);
  check("Blob: cancel works and updates the account copy", cancelled.ok && (await users2.findById(racers[0].id))?.bookings?.[0].status === "cancelled");

  console.log(fails ? `\n${fails} FAILED` : "\nAll Blob-safety checks passed");
  process.exit(fails ? 1 : 0);
})();
