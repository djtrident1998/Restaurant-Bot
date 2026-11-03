// Chat replies for "book a table" and "cancel my booking" (typed or spoken). Answered by code, never by the AI, and nothing is
// booked or cancelled here: the reply only PREPARES the action and shows a confirm button. The button then calls the same
// checked booking API as the Book a table page (own bookings only, capacity and races decided inside the store).
import type { UserStore } from "./auth/store";
import { BOOKING, cancelCheck, dateError, formatDate, formatTime, isUpcoming, validParty, type BookingRef, type SlotStatus } from "./booking";
import { getAvailability } from "./bookingService";
import type { BookingStore } from "./bookings/store";
import { BOOKING_ASK_MARKER, CANCEL_ASK_MARKER, SEATING_HOURS, type BookingRequest } from "./bookingIntent";
import { SIGN_IN_MARKER } from "./chatMessages";

export interface BookingReply {
  text: string;
  outputs: { toolName: string; input: unknown; output: unknown }[];
}

const SIGN_IN_TO_BOOK = `To book or cancel a table, please ${SIGN_IN_MARKER}. Then ask me again and I'll take care of it.`;
const MAX_CHIPS = 6;

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const nearestSeatings = (time: string, n = 3) =>
  [...BOOKING.seatings].sort((a, b) => Math.abs(mins(a) - mins(time)) - Math.abs(mins(b) - mins(time)) || mins(a) - mins(b)).slice(0, n).sort((a, b) => mins(a) - mins(b));

const slotsOutput = (date: string, party: number, times: string[]) => ({
  toolName: "booking_slots",
  input: { date, party },
  output: { ok: true, date, party, times },
});

export async function handleBookingRequest(
  deps: { bookings: BookingStore; users: UserStore },
  user: { id: string; name: string } | undefined,
  req: BookingRequest,
  now = Date.now(),
): Promise<BookingReply> {
  if (!user) return { text: SIGN_IN_TO_BOOK, outputs: [] };
  return req.kind === "cancel" ? cancelReply(deps, user.id, req, now) : bookReply(deps, user.id, req, now);
}

async function bookReply(deps: { bookings: BookingStore; users: UserStore }, userId: string, req: Extract<BookingRequest, { kind: "book" }>, now: number): Promise<BookingReply> {
  const { date, time, party } = req;

  if (party !== undefined && !validParty(party))
    return { text: `Online I can seat parties of 1 to ${BOOKING.maxParty}. For a larger group please call the restaurant and we'll arrange it.`, outputs: [] };

  if (date) {
    const de = dateError(date, now);
    if (de) return { text: `${de} Which day would you like instead?`, outputs: [] };
  }

  const upcoming = ((await deps.users.findById(userId))?.bookings ?? []).filter((b) => isUpcoming(b, now));
  if (upcoming.length >= BOOKING.maxActivePerUser)
    return { text: `You already have ${BOOKING.maxActivePerUser} upcoming bookings. Say "cancel my booking" to free one up, then I can book another.`, outputs: [] };

  if (!date || party === undefined) {
    const need = [party === undefined ? "how many people" : "", !date ? "which day" : "", time ? "" : "what time"].filter(Boolean);
    return {
      text: `Sure. ${BOOKING_ASK_MARKER[0].toUpperCase()}${BOOKING_ASK_MARKER.slice(1)}, I just need ${need.join(", ").replace(/, ([^,]*)$/, " and $1")} (we seat at ${SEATING_HOURS}). For example: "4 people tomorrow at 8 pm".`,
      outputs: [],
    };
  }

  const a = await getAvailability(deps.bookings, date, party, now);
  if (!a.ok) return { text: a.error, outputs: [] };
  const free = (s: SlotStatus) => s.available;
  const openTimes = a.slots.filter(free).map((s) => s.time);

  const dayLabel = formatDate(date);
  if (!time) {
    if (openTimes.length === 0) return { text: `Sorry, there is no table free for ${party} on ${dayLabel}. Would another day work?`, outputs: [] };
    return {
      text: `Here are the free times for **${party} ${party === 1 ? "person" : "people"}** on **${dayLabel}**. Tap one, or tell me the time you prefer.`,
      outputs: [slotsOutput(date, party, openTimes.slice(0, MAX_CHIPS * 2))],
    };
  }

  if (!(BOOKING.seatings as readonly string[]).includes(time)) {
    const near = nearestSeatings(time).filter((t) => openTimes.includes(t));
    return {
      text: `We seat at ${SEATING_HOURS}, in half-hour steps, so ${formatTime(time)} isn't a start time.${near.length ? " The closest free times are below." : " None of the closest times are free that day. Would another day work?"}`,
      outputs: near.length ? [slotsOutput(date, party, near)] : [],
    };
  }

  const slot = a.slots.find((s) => s.time === time);
  if (slot?.available) {
    return {
      text: `I can seat **${party} ${party === 1 ? "person" : "people"}** on **${dayLabel} at ${formatTime(time)}**. Tap the button to confirm the booking, or say "yes".`,
      outputs: [{ toolName: "booking_offer", input: { date, time, party }, output: { ok: true, date, time, party } }],
    };
  }

  const others = openTimes.filter((t) => t !== time).sort((x, y) => Math.abs(mins(x) - mins(time)) - Math.abs(mins(y) - mins(time))).slice(0, 4).sort((x, y) => mins(x) - mins(y));
  const why = slot?.reason === "too-soon" ? "That time is too soon to book online." : `Sorry, ${formatTime(time)} is full.`;
  return {
    text: others.length ? `${why} These times are free on ${dayLabel}:` : `${why} There is nothing else free that day. Would another day work?`,
    outputs: others.length ? [slotsOutput(date, party, others)] : [],
  };
}

async function cancelReply(deps: { users: UserStore }, userId: string, req: Extract<BookingRequest, { kind: "cancel" }>, now: number): Promise<BookingReply> {
  const all = ((await deps.users.findById(userId))?.bookings ?? []).filter((b) => isUpcoming(b, now)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (all.length === 0) return { text: "You don't have an upcoming table booking to cancel.", outputs: [] };

  let pick: BookingRef[] = all;
  if (req.date) pick = pick.filter((b) => b.date === req.date);
  if (req.time) pick = pick.filter((b) => b.time === req.time);
  if (pick.length === 0) return { text: `I couldn't find a booking for that. You have: ${all.map((b) => `${formatDate(b.date)} at ${formatTime(b.time)}`).join("; ")}. ${CANCEL_ASK_MARKER[0].toUpperCase()}${CANCEL_ASK_MARKER.slice(1)}?`, outputs: [] };

  const outputs = pick.slice(0, 3).map((b) => ({
    toolName: "booking_cancel_offer",
    input: { id: b.id },
    output: { ok: true, booking: { id: b.id, date: b.date, time: b.time, party: b.party, table: b.table }, allowed: cancelCheck(b, now).ok, message: cancelCheck(b, now).ok ? "" : (cancelCheck(b, now) as { message: string }).message },
  }));
  if (pick.length === 1) {
    const b = pick[0];
    const c = cancelCheck(b, now);
    return {
      text: c.ok
        ? `Your booking for **${b.party} ${b.party === 1 ? "person" : "people"}** on **${formatDate(b.date)} at ${formatTime(b.time)}** can be cancelled free of charge. Tap the button to cancel it, or say "yes".`
        : `Your booking on ${formatDate(b.date)} at ${formatTime(b.time)}: ${c.message}`,
      outputs,
    };
  }
  return { text: `You have ${pick.length} upcoming bookings. ${CANCEL_ASK_MARKER[0].toUpperCase()}${CANCEL_ASK_MARKER.slice(1)}? Tap one below.`, outputs };
}
