// Table booking rules and availability, as pure functions (browser-safe, unit-tested). Which table a party gets, whether
// a slot is open, and what can be cancelled are all decided HERE, in code — never by the AI and never by the browser.
// The restaurant's opening hours and tables below are demo defaults for the fictional restaurant; change them here.

export const BOOKING = {
  tzOffsetMin: 330, // India Standard Time (UTC+05:30)
  /** Seating start times (24h, IST): a lunch and a dinner service. */
  seatings: ["12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30"],
  durationMin: 90, // how long a party keeps its table
  holdMin: 15, // a table is held this long after the booking time for late arrivals
  leadMin: 60, // a slot closes this long before it starts
  maxDaysAhead: 30,
  maxParty: 8,
  maxActivePerUser: 3, // upcoming confirmed bookings one customer can hold
  cancelCutoffMin: 120, // free cancellation until this long before the booking
  notesMax: 140,
} as const;

export interface Table {
  id: string;
  seats: number;
}

/** The dining room: 11 tables, 44 seats (4 x 2, 4 x 4, 2 x 6, 1 x 8). */
export const TABLES: readonly Table[] = [
  { id: "T1", seats: 2 },
  { id: "T2", seats: 2 },
  { id: "T3", seats: 2 },
  { id: "T4", seats: 2 },
  { id: "T5", seats: 4 },
  { id: "T6", seats: 4 },
  { id: "T7", seats: 4 },
  { id: "T8", seats: 4 },
  { id: "T9", seats: 6 },
  { id: "T10", seats: 6 },
  { id: "T11", seats: 8 },
];

export type BookingStatus = "confirmed" | "cancelled";

export interface Booking {
  id: string; // BK-<yymmdd>-<3 digits>: the date is in the id, so cancelling needs no lookup
  userId: string;
  name: string;
  date: string; // YYYY-MM-DD (restaurant's local date)
  time: string; // HH:MM (restaurant's local time)
  party: number;
  table: string;
  notes: string;
  status: BookingStatus;
  createdAt: number;
  cancelledAt?: number;
}

/** What an account keeps about each of its bookings (for the "Your bookings" list). */
export type BookingRef = Pick<Booking, "id" | "date" | "time" | "party" | "table" | "notes" | "status" | "createdAt">;

// ---------- dates and times ----------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const BOOKING_ID_RE = /^BK-\d{6}-\d{3}$/;

/** Epoch milliseconds of a restaurant-local date + time. */
export function slotStartMs(date: string, time: string): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return Date.UTC(y, m - 1, d, hh, mm) - BOOKING.tzOffsetMin * 60_000;
}

/** Today's date in the restaurant's time zone. */
export function todayLocal(now = Date.now()): string {
  return new Date(now + BOOKING.tzOffsetMin * 60_000).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/** null if the date can be booked, otherwise a plain-language reason. */
export function dateError(date: unknown, now = Date.now()): string | null {
  if (typeof date !== "string" || !DATE_RE.test(date)) return "Please choose a date.";
  const t = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== date) return "That isn't a real date.";
  const today = todayLocal(now);
  if (date < today) return "That date has already passed.";
  if (date > addDays(today, BOOKING.maxDaysAhead)) return `Bookings open up to ${BOOKING.maxDaysAhead} days ahead.`;
  return null;
}

/** "19:30" -> "7:30 pm" */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

/** "2026-11-05" -> "Thu, 5 Nov" (no time-zone drift: the date is formatted as UTC). */
export function formatDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}

// ---------- tables and availability ----------

const overlaps = (timeA: string, timeB: string) => Math.abs(slotStartMs("2000-01-01", timeA) - slotStartMs("2000-01-01", timeB)) < BOOKING.durationMin * 60_000;

/** Confirmed bookings that hold a table during a slot starting at `time`. */
export function holding(day: Booking[], time: string): Booking[] {
  return day.filter((b) => b.status === "confirmed" && overlaps(b.time, time));
}

/** Tables big enough for the party and free for the whole slot, smallest first (so big tables stay free for big parties). */
export function freeTables(day: Booking[], time: string, party: number): Table[] {
  const taken = new Set(holding(day, time).map((b) => b.table));
  return TABLES.filter((t) => t.seats >= party && !taken.has(t.id)).sort((a, b) => a.seats - b.seats || a.id.localeCompare(b.id, undefined, { numeric: true }));
}

export function assignTable(day: Booking[], time: string, party: number): Table | null {
  return freeTables(day, time, party)[0] ?? null;
}

export type SlotReason = "party" | "too-soon" | "full";
export interface SlotStatus {
  time: string;
  available: boolean;
  reason?: SlotReason;
}

export const validParty = (p: unknown): p is number => typeof p === "number" && Number.isInteger(p) && p >= 1 && p <= BOOKING.maxParty;

export function slotStatus(day: Booking[], date: string, time: string, party: number, now = Date.now()): SlotStatus {
  if (!validParty(party)) return { time, available: false, reason: "party" };
  if (slotStartMs(date, time) < now + BOOKING.leadMin * 60_000) return { time, available: false, reason: "too-soon" };
  if (!assignTable(day, time, party)) return { time, available: false, reason: "full" };
  return { time, available: true };
}

export function availability(day: Booking[], date: string, party: number, now = Date.now()): SlotStatus[] {
  return BOOKING.seatings.map((time) => slotStatus(day, date, time, party, now));
}

// ---------- input and ids ----------

export type BookingInput = { date: string; time: string; party: number; notes: string };

export function parseBookingInput(raw: unknown, now = Date.now()): { ok: true; input: BookingInput } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const de = dateError(r.date, now);
  if (de) return { ok: false, error: de };
  if (typeof r.time !== "string" || !(BOOKING.seatings as readonly string[]).includes(r.time)) return { ok: false, error: "Please choose one of the available times." };
  if (!validParty(r.party)) return { ok: false, error: `We seat parties of 1 to ${BOOKING.maxParty}. For larger groups, please contact the restaurant.` };
  const notes = typeof r.notes === "string" ? r.notes.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim() : "";
  if (notes.length > BOOKING.notesMax) return { ok: false, error: `Please keep notes under ${BOOKING.notesMax} characters.` };
  return { ok: true, input: { date: r.date as string, time: r.time, party: r.party, notes } };
}

export function newBookingId(date: string, taken: Set<string>, rand: () => number = Math.random): string {
  const yymmdd = date.slice(2).replace(/-/g, "");
  for (let i = 0; i < 50; i++) {
    const id = `BK-${yymmdd}-${Math.floor(100 + rand() * 900)}`;
    if (!taken.has(id)) return id;
  }
  throw new Error("could not allocate a booking id");
}

/** The booking's date, read back out of its id (so a cancel request needs only the id). */
export function dateFromBookingId(id: string): string | null {
  const m = BOOKING_ID_RE.exec(id);
  if (!m) return null;
  const s = id.slice(3, 9);
  const date = `20${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
  return dateError(date, Date.UTC(2000, 0, 1)) === "That isn't a real date." ? null : date;
}

// ---------- cancelling ----------

export type CancelCheck = { ok: true } | { ok: false; reason: "cancelled" | "late"; message: string };

export function cancelCheck(b: Pick<Booking, "date" | "time" | "status">, now = Date.now()): CancelCheck {
  if (b.status === "cancelled") return { ok: false, reason: "cancelled", message: "This booking is already cancelled." };
  if (slotStartMs(b.date, b.time) - now < BOOKING.cancelCutoffMin * 60_000)
    return { ok: false, reason: "late", message: `Bookings can be cancelled up to ${BOOKING.cancelCutoffMin / 60} hours before the time. Please call the restaurant instead.` };
  return { ok: true };
}

// ---------- calendar invite ----------

const icsUtc = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

/** An .ics calendar file for a booking (opens in Google/Apple/Outlook calendars). Contains no personal details. */
export function bookingIcs(b: Pick<BookingRef, "id" | "date" | "time" | "party" | "table" | "createdAt">, restaurant = "Spice Route"): string {
  const start = slotStartMs(b.date, b.time);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${restaurant}//Table booking//EN`,
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${b.id}@spice-route`,
    `DTSTAMP:${icsUtc(b.createdAt)}`,
    `DTSTART:${icsUtc(start)}`,
    `DTEND:${icsUtc(start + BOOKING.durationMin * 60_000)}`,
    `SUMMARY:Table for ${b.party} at ${restaurant}`,
    `DESCRIPTION:Booking ${b.id}\\, table ${b.table}. Please arrive within ${BOOKING.holdMin} minutes of the time. Free cancellation until ${BOOKING.cancelCutoffMin / 60} hours before. This is a demonstration booking.`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** Is this booking still ahead of us (not past, not cancelled)? */
export const isUpcoming = (b: Pick<Booking, "date" | "time" | "status">, now = Date.now()) => b.status === "confirmed" && slotStartMs(b.date, b.time) + BOOKING.durationMin * 60_000 > now;
