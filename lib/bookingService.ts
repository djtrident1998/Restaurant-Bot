import type { UserStore } from "./auth/store";
import {
  BOOKING,
  assignTable,
  availability,
  cancelCheck,
  dateError,
  dateFromBookingId,
  isUpcoming,
  newBookingId,
  parseBookingInput,
  slotStartMs,
  slotStatus,
  validParty,
  type Booking,
  type BookingRef,
  type SlotStatus,
} from "./booking";
import type { BookingStore } from "./bookings/store";

export type CreateResult = { ok: true; booking: BookingRef } | { ok: false; status: 400 | 404 | 409 | 500; error: string };
export type CancelResult = { ok: true; booking: BookingRef } | { ok: false; status: 400 | 404 | 409; error: string };

const toRef = (b: Booking): BookingRef => ({ id: b.id, date: b.date, time: b.time, party: b.party, table: b.table, notes: b.notes, status: b.status, createdAt: b.createdAt });
const FULL = "Sorry, that time just filled up. Please pick another.";

/** Free times for a date and party size. Public (no sign-in needed to look). */
export async function getAvailability(bookings: BookingStore, rawDate: unknown, rawParty: unknown, now = Date.now()): Promise<{ ok: true; date: string; party: number; slots: SlotStatus[] } | { ok: false; error: string }> {
  const de = dateError(rawDate, now);
  if (de) return { ok: false, error: de };
  const party = Number(rawParty ?? 2);
  if (!validParty(party)) return { ok: false, error: `We seat parties of 1 to ${BOOKING.maxParty}.` };
  const date = rawDate as string;
  return { ok: true, date, party, slots: availability(await bookings.read(date), date, party, now) };
}

/**
 * Book a table for the signed-in customer. The table is chosen by code, inside the store's atomic update, so two people
 * asking for the last table at the same moment get one "yes" and one "just filled up".
 */
export async function createBooking(bookings: BookingStore, users: UserStore, user: { id: string; name: string }, raw: unknown, now = Date.now()): Promise<CreateResult> {
  const p = parseBookingInput(raw, now);
  if (!p.ok) return { ok: false, status: 400, error: p.error };
  const { date, time, party, notes } = p.input;

  const record = await users.findById(user.id);
  if (!record) return { ok: false, status: 404, error: "We couldn't find your account." };
  const upcoming = (record.bookings ?? []).filter((b) => isUpcoming(b, now));
  if (upcoming.length >= BOOKING.maxActivePerUser) return { ok: false, status: 409, error: `You already have ${BOOKING.maxActivePerUser} upcoming bookings. Cancel one to make another.` };

  const outcome = await bookings.update<{ error: string; status: 409 } | { booking: Booking }>(date, (day) => {
    const clash = day.some((b) => b.userId === user.id && b.status === "confirmed" && Math.abs(slotStartMs(date, b.time) - slotStartMs(date, time)) < BOOKING.durationMin * 60_000);
    if (clash) return { write: false, result: { error: "You already have a booking around that time.", status: 409 as const } };
    const s = slotStatus(day, date, time, party, now);
    if (!s.available) return { write: false, result: { error: s.reason === "too-soon" ? "That time is too soon to book online. Please pick a later slot." : FULL, status: 409 as const } };
    const table = assignTable(day, time, party);
    if (!table) return { write: false, result: { error: FULL, status: 409 as const } };
    const booking: Booking = {
      id: newBookingId(date, new Set(day.map((b) => b.id))),
      userId: user.id,
      name: user.name,
      date,
      time,
      party,
      table: table.id,
      notes,
      status: "confirmed",
      createdAt: now,
    };
    day.push(booking);
    return { write: true, result: { booking } };
  });
  if ("error" in outcome) return { ok: false, status: outcome.status, error: outcome.error };

  const ref = toRef(outcome.booking);
  try {
    await users.updateUser(user.id, (u) => {
      u.bookings = [...(u.bookings ?? []), ref];
      return true;
    });
  } catch (e) {
    // Keep the two records consistent: release the table again rather than leave a booking the customer can't see.
    console.error("[booking] could not save to account", String(e).slice(0, 160));
    await bookings.update(date, (day) => {
      const b = day.find((x) => x.id === ref.id);
      if (b) b.status = "cancelled";
      return { write: !!b, result: null };
    }).catch(() => undefined);
    return { ok: false, status: 500, error: "We couldn't save your booking. Please try again." };
  }
  return { ok: true, booking: ref };
}

/** Cancel one of the customer's own bookings (up to 2 hours before). Frees the table. */
export async function cancelBooking(bookings: BookingStore, users: UserStore, userId: string, rawId: unknown, now = Date.now()): Promise<CancelResult> {
  const id = typeof rawId === "string" ? rawId.trim().toUpperCase() : "";
  const date = dateFromBookingId(id);
  if (!date) return { ok: false, status: 400, error: "Please give a booking id like BK-261105-482." };

  const outcome = await bookings.update<{ error: string; status: 404 | 409 } | { booking: Booking }>(date, (day) => {
    const b = day.find((x) => x.id === id && x.userId === userId); // someone else's id is simply "not found"
    if (!b) return { write: false, result: { error: "We couldn't find that booking on your account.", status: 404 as const } };
    const c = cancelCheck(b, now);
    if (!c.ok) return { write: false, result: { error: c.message, status: 409 as const } };
    b.status = "cancelled";
    b.cancelledAt = now;
    return { write: true, result: { booking: { ...b } } };
  });
  if ("error" in outcome) return { ok: false, status: outcome.status, error: outcome.error };

  try {
    await users.updateUser(userId, (u) => {
      const r = (u.bookings ?? []).find((x) => x.id === id);
      if (!r || r.status === "cancelled") return false;
      r.status = "cancelled";
      return true;
    });
  } catch (e) {
    console.error("[booking] cancelled, but could not update account copy", String(e).slice(0, 160));
  }
  return { ok: true, booking: toRef(outcome.booking) };
}

/**
 * Used when an account is deleted: free every table it still holds and scrub the personal details from ALL its
 * bookings in the shared day files (the name and notes), so nothing identifiable outlives the account.
 */
export async function releaseAndScrubBookings(bookings: BookingStore, refs: BookingRef[], userId: string, now = Date.now()): Promise<void> {
  const dates = [...new Set(refs.map((r) => r.date))];
  for (const date of dates) {
    await bookings.update(date, (day) => {
      let changed = false;
      for (const b of day) {
        if (b.userId !== userId) continue;
        if (b.status === "confirmed") {
          b.status = "cancelled";
          b.cancelledAt = now;
        }
        b.userId = "deleted";
        b.name = "Deleted customer";
        b.notes = "";
        changed = true;
      }
      return { write: changed, result: null };
    });
  }
}
