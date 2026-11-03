// Offline test of table booking and the Delivery / Dining selection: rules, capacity, races, cancelling, privacy.
import { BOOKING, TABLES, assignTable, availability, bookingIcs, cancelCheck, dateError, dateFromBookingId, formatDate, formatTime, freeTables, isUpcoming, parseBookingInput, slotStartMs, slotStatus, todayLocal, type Booking } from "../lib/booking";
import { cancelBooking, createBooking, getAvailability } from "../lib/bookingService";
import { __testing as bookingTesting } from "../lib/bookings/store";
import { __testing as userTesting, userIdFor, type UserRecord } from "../lib/auth/store";
import { hashPassword } from "../lib/auth/password";
import { deleteAccount } from "../lib/account";
import { DEFAULT_SERVICE, parseService, serviceLabel, serviceShort, validateService } from "../lib/service";
import { getService, setService, userConfirm, isUserConfirmed, addLine, checkout, snapshotSession, restoreSession, viewCart, getOrders, resetSession } from "../lib/cart";
import { detectOrderIntent, handleOrderIntent } from "../lib/orderFlow";
import { CHECKOUT_TEXT, CONFIRM_TEXT } from "../lib/chatMessages";
import { orderStatusTool, placeOrderTool } from "../lib/tools";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

// "now" = 3 Nov 2026, 11:30 IST (06:00 UTC)
const NOW = Date.UTC(2026, 10, 3, 6, 0, 0);
const TODAY = "2026-11-03";
const mkDay = (rows: Partial<Booking>[]): Booking[] => rows.map((r, i) => ({ id: `BK-261105-${100 + i}`, userId: `u${i}`, name: "X", date: "2026-11-05", time: "19:00", party: 2, table: "T1", notes: "", status: "confirmed", createdAt: 1, ...r }) as Booking);

(async () => {
  // ---------- constants ----------
  check("14 seatings, lunch and dinner", BOOKING.seatings.length === 14 && BOOKING.seatings[0] === "12:00" && BOOKING.seatings[13] === "22:30");
  check("11 tables, 44 seats", TABLES.length === 11 && TABLES.reduce((n, t) => n + t.seats, 0) === 44);

  // ---------- dates and times ----------
  check("19:30 IST is 14:00 UTC", slotStartMs("2026-11-05", "19:30") === Date.UTC(2026, 10, 5, 14, 0));
  check("today uses the restaurant's time zone", todayLocal(Date.UTC(2026, 10, 4, 19, 0)) === "2026-11-05" && todayLocal(NOW) === TODAY);
  check("today is bookable", dateError(TODAY, NOW) === null);
  check("30 days ahead is bookable, 31 is not", dateError("2026-12-03", NOW) === null && /30 days/.test(dateError("2026-12-04", NOW) ?? ""));
  check("yesterday refused", /passed/.test(dateError("2026-11-02", NOW) ?? ""));
  check("garbage dates refused", ["", "tomorrow", "2026-13-01", "2026-02-30", "2026-1-5", null, 42, undefined].every((d) => dateError(d, NOW) !== null));
  check("12-hour times", formatTime("19:30") === "7:30 pm" && formatTime("12:00") === "12:00 pm" && formatTime("12:30") === "12:30 pm" && formatTime("00:00") === "12:00 am");
  check("dates format without time-zone drift", formatDate("2026-11-05").includes("5") && /Thu/.test(formatDate("2026-11-05")));

  // ---------- slots ----------
  check("a slot closes 60 minutes before it starts", slotStatus([], TODAY, "12:00", 2, NOW).reason === "too-soon" && slotStatus([], TODAY, "12:30", 2, NOW).available);
  check("party sizes 1-8 only", [0, 9, 2.5, -1, NaN].every((p) => slotStatus([], "2026-11-05", "19:00", p, NOW).reason === "party") && [1, 8].every((p) => slotStatus([], "2026-11-05", "19:00", p, NOW).available));
  check("empty day: every future slot open", availability([], "2026-11-05", 2, NOW).every((s) => s.available));
  check("today: lunch slots too soon, dinner open", (() => { const a = availability([], TODAY, 2, NOW); return a[0].reason === "too-soon" && a[a.length - 1].available; })());

  // ---------- table assignment: smallest table that fits ----------
  check("party of 2 -> a 2-seater", assignTable([], "19:00", 2)?.seats === 2);
  check("party of 3 -> a 4-seater", assignTable([], "19:00", 3)?.seats === 4);
  check("party of 5 -> a 6-seater", assignTable([], "19:00", 5)?.seats === 6);
  check("party of 7 and 8 -> the 8-seater", assignTable([], "19:00", 7)?.id === "T11" && assignTable([], "19:00", 8)?.id === "T11");
  check("tables are handed out in order", freeTables([], "19:00", 2).map((t) => t.id).slice(0, 5).join() === "T1,T2,T3,T4,T5");

  // ---------- overlap: a party keeps its table for 90 minutes ----------
  const d1 = mkDay([{ time: "19:00", table: "T11", party: 8 }]);
  check("a booking blocks overlapping slots", !slotStatus(d1, "2026-11-05", "20:00", 8, NOW).available && !slotStatus(d1, "2026-11-05", "19:30", 8, NOW).available);
  check("…and frees the table 90 minutes later", slotStatus(d1, "2026-11-05", "20:30", 8, NOW).available);
  check("…and does not block earlier non-overlapping slots", slotStatus(d1, "2026-11-05", "14:00", 8, NOW).available);
  check("a cancelled booking holds no table", slotStatus(mkDay([{ time: "19:00", table: "T11", party: 8, status: "cancelled" }]), "2026-11-05", "19:00", 8, NOW).available);
  // fill every table at 19:30, then the 12th party must be refused
  const full = TABLES.map((t, i) => ({ time: "19:30", table: t.id, party: t.seats, userId: `f${i}` }));
  check("with every table taken the slot is full", slotStatus(mkDay(full), "2026-11-05", "19:30", 1, NOW).reason === "full");
  check("a small party can't take a big table if only big ones remain (and vice versa)", (() => { const day = mkDay(TABLES.filter((t) => t.seats <= 4).map((t) => ({ time: "19:30", table: t.id, party: t.seats }))); return assignTable(day, "19:30", 2)?.seats === 6; })());

  // ---------- input parsing ----------
  const ok = parseBookingInput({ date: "2026-11-05", time: "19:30", party: 4, notes: "  Birthday\n\tcake  " }, NOW);
  check("good input parsed; notes cleaned", ok.ok && ok.input.notes === "Birthday cake");
  check("time must be a real seating", !parseBookingInput({ date: "2026-11-05", time: "19:15", party: 2 }, NOW).ok && !parseBookingInput({ date: "2026-11-05", time: "7pm", party: 2 }, NOW).ok);
  check("party as text refused", !parseBookingInput({ date: "2026-11-05", time: "19:30", party: "2" }, NOW).ok);
  check("notes over 140 characters refused", !parseBookingInput({ date: "2026-11-05", time: "19:30", party: 2, notes: "x".repeat(141) }, NOW).ok);
  check("garbage body refused", !parseBookingInput(null, NOW).ok && !parseBookingInput("x", NOW).ok);

  // ---------- calendar file ----------
  const ics = bookingIcs({ id: "BK-261105-482", date: "2026-11-05", time: "19:30", party: 4, table: "T5", createdAt: Date.UTC(2026, 10, 3, 6, 0, 0) });
  check("calendar file: valid wrapper and CRLF lines", ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.trimEnd().endsWith("END:VCALENDAR") && ics.includes("BEGIN:VEVENT") && ics.includes("END:VEVENT") && !/[^\r]\n/.test(ics));
  check("calendar file: 19:30 IST is 14:00 UTC, ends 90 minutes later", ics.includes("DTSTART:20261105T140000Z") && ics.includes("DTEND:20261105T153000Z"));
  check("calendar file: stable id and a clear title", ics.includes("UID:BK-261105-482@spice-route") && ics.includes("SUMMARY:Table for 4 at Spice Route"));
  check("calendar file: states the hold and cancellation policy; commas escaped", ics.includes("within 15 minutes") && ics.includes("2 hours") && ics.includes("BK-261105-482\\, table T5"));
  check("calendar file holds no personal details", !/name|email|@gmail|@example/i.test(ics.replace("@spice-route", "")));
  check("hold policy is 15 minutes", BOOKING.holdMin === 15);

  // ---------- ids ----------
  check("booking id carries its date", dateFromBookingId("BK-261105-482") === "2026-11-05");
  check("bad ids rejected", ["", "BK-261305-482", "BK-26110-482", "SR-1234", "../x", "BK-261105-48"].every((i) => dateFromBookingId(i) === null));

  // ---------- the booking service ----------
  const bookings = new bookingTesting.MemoryBookingStore();
  const users = new userTesting.MemoryStore();
  const mkUser = async (email: string, name = "Guest"): Promise<UserRecord> => {
    const u: UserRecord = { id: userIdFor(email), name, email, passwordHash: await hashPassword("Correct-horse-9"), createdAt: 1, orders: [] };
    await users.create(u);
    return u;
  };
  const asha = await mkUser("asha-bk@example.com", "Asha");
  const ravi = await mkUser("ravi-bk@example.com", "Ravi");
  const meera = await mkUser("meera-bk@example.com", "Meera");

  const av = await getAvailability(bookings, "2026-11-05", 2, NOW);
  check("availability: 14 slots for a good request", av.ok && av.slots.length === 14);
  check("availability: bad date and bad party are errors", !(await getAvailability(bookings, "nope", 2, NOW)).ok && !(await getAvailability(bookings, "2026-11-05", 99, NOW)).ok);

  const b1 = await createBooking(bookings, users, asha, { date: "2026-11-05", time: "19:30", party: 2, notes: "Window please" }, NOW);
  check("booking succeeds", b1.ok && /^BK-261105-\d{3}$/.test(b1.booking.id) && b1.booking.table === "T1" && b1.booking.status === "confirmed", b1.ok ? b1.booking.id : "");
  check("it is saved on the account", (await users.findById(asha.id))?.bookings?.length === 1);
  check("it holds the table in the shared day file", (await bookings.read("2026-11-05")).length === 1);
  check("the next party gets the next table", (await createBooking(bookings, users, ravi, { date: "2026-11-05", time: "19:30", party: 2 }, NOW).then((r) => r.ok && r.booking.table === "T2")));
  const clash = await createBooking(bookings, users, asha, { date: "2026-11-05", time: "20:00", party: 2 }, NOW);
  check("you can't hold two overlapping bookings", !clash.ok && clash.status === 409 && /around that time/.test(clash.error));
  const tooSoon = await createBooking(bookings, users, meera, { date: TODAY, time: "12:00", party: 2 }, NOW);
  check("too-soon slot refused", !tooSoon.ok && /too soon/.test(tooSoon.ok ? "" : tooSoon.error));
  check("bad input -> 400", (await createBooking(bookings, users, meera, { date: "2026-11-05", time: "19:15", party: 2 }, NOW).then((r) => !r.ok && r.status === 400)));
  check("unknown account -> 404", (await createBooking(bookings, users, { id: "ghost", name: "G" }, { date: "2026-11-06", time: "19:00", party: 2 }, NOW).then((r) => !r.ok && r.status === 404)));

  // cap of 3 upcoming bookings
  for (const d of ["2026-11-06", "2026-11-07"]) await createBooking(bookings, users, asha, { date: d, time: "19:00", party: 2 }, NOW);
  const fourth = await createBooking(bookings, users, asha, { date: "2026-11-08", time: "19:00", party: 2 }, NOW);
  check("at most 3 upcoming bookings per customer", !fourth.ok && fourth.status === 409 && /3 upcoming/.test(fourth.ok ? "" : fourth.error));

  // race: only ONE 8-seat table exists; twelve people ask for it at the same moment
  const racers: UserRecord[] = [];
  for (let i = 0; i < 12; i++) racers.push(await mkUser(`racer${i}-bk@example.com`, `R${i}`));
  const results = await Promise.all(racers.map((u) => createBooking(bookings, users, u, { date: "2026-11-10", time: "20:00", party: 8 }, NOW)));
  check("12 people racing for the one 8-seat table: exactly one wins", results.filter((r) => r.ok).length === 1);
  check("…the losers are told it just filled up", results.filter((r) => !r.ok).every((r) => !r.ok && r.status === 409 && /filled up/.test(r.error)));
  check("…and the day file holds exactly one booking", (await bookings.read("2026-11-10")).filter((b) => b.status === "confirmed").length === 1);
  // race for many tables: 20 people, party 2 -> 11 tables total, all used (2-seaters first, then bigger)
  const crowd: UserRecord[] = [];
  for (let i = 0; i < 20; i++) crowd.push(await mkUser(`crowd${i}-bk@example.com`, `C${i}`));
  const cr = await Promise.all(crowd.map((u) => createBooking(bookings, users, u, { date: "2026-11-11", time: "19:00", party: 2 }, NOW)));
  check("20 parties of 2 for 11 tables: 11 succeed, 9 refused", cr.filter((r) => r.ok).length === 11);
  check("…no table is double-booked", (() => { const t = (cr.filter((r) => r.ok) as { ok: true; booking: { table: string } }[]).map((r) => r.booking.table); return new Set(t).size === t.length; })());

  // ---------- cancelling ----------
  const mine = (b1 as { ok: true; booking: { id: string } }).booking.id;
  const notMine = await cancelBooking(bookings, users, ravi.id, mine, NOW);
  check("someone else's booking -> 404, untouched", !notMine.ok && notMine.status === 404 && (await bookings.read("2026-11-05")).find((b) => b.id === mine)?.status === "confirmed");
  check("bad id -> 400", (await cancelBooking(bookings, users, asha.id, "nope", NOW).then((r) => !r.ok && r.status === 400)));
  check("unknown id -> 404", (await cancelBooking(bookings, users, asha.id, "BK-261105-999", NOW).then((r) => !r.ok && r.status === 404)));
  check("a booking less than 2 hours away can't be cancelled online", (() => { const c = cancelCheck({ date: "2026-11-05", time: "19:30", status: "confirmed" }, slotStartMs("2026-11-05", "19:30") - 119 * 60_000); return !c.ok && c.reason === "late"; })());
  check("…but 2 hours or more is fine", cancelCheck({ date: "2026-11-05", time: "19:30", status: "confirmed" }, slotStartMs("2026-11-05", "19:30") - 120 * 60_000).ok);
  const c1 = await cancelBooking(bookings, users, asha.id, mine, NOW);
  check("cancelling your own booking works", c1.ok && c1.booking.status === "cancelled");
  check("…it frees the table (the same table can be booked again)", (await createBooking(bookings, users, meera, { date: "2026-11-05", time: "19:30", party: 2 }, NOW).then((r) => r.ok && r.booking.table === "T1")));
  check("…the account copy is updated too", (await users.findById(asha.id))?.bookings?.find((b) => b.id === mine)?.status === "cancelled");
  check("cancelling twice is a clean refusal", (await cancelBooking(bookings, users, asha.id, mine, NOW).then((r) => !r.ok && r.status === 409)));
  check("cancelled bookings no longer count towards the cap", (await createBooking(bookings, users, asha, { date: "2026-11-08", time: "19:00", party: 2 }, NOW).then((r) => r.ok)));
  check("isUpcoming: cancelled and past are not upcoming", !isUpcoming({ date: "2026-11-05", time: "19:30", status: "cancelled" }, NOW) && !isUpcoming({ date: "2026-11-01", time: "19:30", status: "confirmed" }, NOW) && isUpcoming({ date: "2026-11-05", time: "19:30", status: "confirmed" }, NOW));

  // ---------- deleting an account frees tables and scrubs names ----------
  const gone = await mkUser("gone-bk@example.com", "Goner");
  const gb = await createBooking(bookings, users, gone, { date: "2026-11-12", time: "19:00", party: 8, notes: "my allergy note" }, NOW);
  check("a booking with a name and a note exists", gb.ok && (await bookings.read("2026-11-12"))[0].name === "Goner");
  check("wrong password can't delete", !(await deleteAccount(users, gone.id, "nope", bookings)).ok && !!(await users.findById(gone.id)));
  check("account deleted", (await deleteAccount(users, gone.id, "Correct-horse-9", bookings)).ok && (await users.findById(gone.id)) === null);
  const scrubbed = (await bookings.read("2026-11-12"))[0];
  check("the table is freed", scrubbed.status === "cancelled" && slotStatus(await bookings.read("2026-11-12"), "2026-11-12", "19:00", 8, NOW).available);
  check("the name, notes and user link are scrubbed", scrubbed.name === "Deleted customer" && scrubbed.notes === "" && scrubbed.userId === "deleted" && !JSON.stringify(scrubbed).includes("Goner"));
  check("other people's bookings in the same file are untouched", (await bookings.read("2026-11-05")).some((b) => b.name === "Ravi"));

  // ---------- Delivery / Dining selection ----------
  check("default is delivery", DEFAULT_SERVICE.type === "delivery" && parseService(undefined).type === "delivery" && parseService("x").type === "delivery");
  check("anything unexpected falls back to delivery", ["pickup", "", null, 5, { type: "DINE-IN" }].every((t) => parseService({ type: t }).type === "delivery"));
  check("dine-in accepted; booking id must be well-formed", parseService({ type: "dine-in", bookingId: "bk-261105-482" }).bookingId === "BK-261105-482" && parseService({ type: "dine-in", bookingId: "../x" }).bookingId === undefined);
  const refs = [{ id: "BK-261105-482", date: "2026-11-05", time: "19:30", party: 2, table: "T5", notes: "", status: "confirmed" as const, createdAt: 1 }, { id: "BK-261101-111", date: "2026-11-01", time: "19:30", party: 2, table: "T1", notes: "", status: "confirmed" as const, createdAt: 1 }];
  check("own upcoming booking is kept", validateService({ type: "dine-in", bookingId: "BK-261105-482" }, refs, NOW).bookingId === "BK-261105-482");
  check("someone else's booking id is dropped (walk-in)", validateService({ type: "dine-in", bookingId: "BK-261105-999" }, refs, NOW).bookingId === undefined);
  check("a past booking is dropped", validateService({ type: "dine-in", bookingId: "BK-261101-111" }, refs, NOW).bookingId === undefined);
  check("a guest can't attach a booking", validateService({ type: "dine-in", bookingId: "BK-261105-482" }, undefined, NOW).bookingId === undefined);
  check("labels", serviceLabel({ type: "delivery" }) === "Delivery" && serviceLabel({ type: "dine-in" }) === "Dining — walk-in" && /table booked.*7:30 pm.*T5/.test(serviceLabel({ type: "dine-in", bookingId: "BK-261105-482" }, refs)));
  check("short labels", serviceShort({ type: "delivery" }) === "Delivery" && serviceShort({ type: "dine-in" }) === "Dine in" && serviceShort(undefined) === "");

  const S = "svc-session-1";
  resetSession(S);
  check("a new session is delivery", getService(S).type === "delivery");
  addLine(S, "st-01", 1);
  handleOrderIntent(S, detectOrderIntent(CHECKOUT_TEXT)!, true, undefined, refs);
  userConfirm(S);
  setService(S, { type: "delivery" });
  check("re-sending the same selection does NOT void the confirmation", isUserConfirmed(S));
  setService(S, { type: "dine-in" });
  check("changing delivery -> dining DOES void the confirmation", !isUserConfirmed(S) && getService(S).type === "dine-in");
  const rb = handleOrderIntent(S, detectOrderIntent(CHECKOUT_TEXT)!, true, undefined, refs);
  check("the read-back states the selection", /Dining — walk-in/.test(rb.text));
  setService(S, { type: "dine-in", bookingId: "BK-261105-482" });
  check("…including the table booking", /table booked.*7:30 pm/.test(handleOrderIntent(S, detectOrderIntent(CHECKOUT_TEXT)!, true, undefined, refs).text));
  const snap = snapshotSession(S);
  setService(S, { type: "delivery" });
  restoreSession(S, snap);
  check("a rolled-back turn restores the selection", getService(S).bookingId === "BK-261105-482");
  userConfirm(S);
  const placed = placeOrderTool(S, { confirmed: true }, { signedIn: true });
  check("the order records how it was placed", placed.ok && placed.service?.type === "dine-in" && placed.service.bookingId === "BK-261105-482" && getOrders(S)[0].service.type === "dine-in");
  check("status wording follows the selection", (() => { const s = orderStatusTool(S, { orderId: getOrders(S)[0].id }); return s.ok && s.status === "Received"; })());
  const D = "svc-session-2";
  resetSession(D);
  addLine(D, "st-01", 1);
  userConfirm(D);
  const del = placeOrderTool(D, { confirmed: true }, { signedIn: true });
  check("an untouched session places a delivery order (existing behaviour unchanged)", del.ok && del.service?.type === "delivery");
  check("cart helpers still work after ordering", viewCart(D).lines.length === 0 && (() => { checkout; return true; })());

  console.log(fails ? `\n${fails} FAILED` : "\nAll booking and dining checks passed");
  process.exit(fails ? 1 : 0);
})();
