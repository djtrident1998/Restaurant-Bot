// Booking and cancelling a table by chat or voice. Recognised by code (no AI call, no tokens), like the cart and cancel-order
// buttons. This file only READS the words (day, time, party size, book or cancel); lib/bookingChat.ts carries a clear request
// out through the checked booking service. Browser-safe and pure.
import { BOOKING, addDays, todayLocal } from "./booking";

export type BookingAsk = "book" | "cancel" | null;
export interface BookingFields {
  date?: string;
  time?: string;
  party?: number;
}
/** `id` (cancel only) is set by the server when the waiter's last message was a booking just made: "cancel it" means that one. */
export type BookingRequest = ({ kind: "book"; /** set by the server when the words say "instead / change / move": replace the overlapping booking */ move?: boolean } & BookingFields) | ({ kind: "cancel"; id?: string } & Pick<BookingFields, "date" | "time">);

/** Phrases the waiter uses when it needs more detail; the next message is then read as an answer. */
export const BOOKING_ASK_MARKER = "to book your table";
export const CANCEL_ASK_MARKER = "which booking would you like to cancel";

const norm = (s: string) => s.toLowerCase().replace(/[â€™']/g, "'").replace(/[^a-z0-9:'./\- ]/g, " ").replace(/\s+/g, " ").trim();

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const NUM = "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)";
const toNum = (s: string) => (/^\d+$/.test(s) ? Number(s) : WORDS[s]);

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const monthIndex = (s: string) => MONTHS.findIndex((m) => m.startsWith(s.slice(0, 3)));

const dow = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();
const validYmd = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m && dt.getUTCDate() === d;
};
const ymd = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** "today", "tomorrow", "saturday", "next friday", "5 nov", "november 5th", "2026-11-05" -> YYYY-MM-DD (India time). */
export function parseDateWords(raw: string, today: string): { date?: string; rest: string } {
  let t = ` ${norm(raw)} `;
  const take = (re: RegExp): RegExpMatchArray | null => {
    const m = t.match(re);
    if (m) t = t.replace(re, " ");
    return m;
  };
  let m = take(/\b(20\d\d)-(\d\d)-(\d\d)\b/);
  if (m && validYmd(+m[1], +m[2] - 1, +m[3])) return { date: `${m[1]}-${m[2]}-${m[3]}`, rest: t };
  if (take(/\bday after tomorrow\b/)) return { date: addDays(today, 2), rest: t };
  if (take(/\btomorrow\b/)) return { date: addDays(today, 1), rest: t };
  if (take(/\b(?:today|tonight|this evening)\b/)) return { date: today, rest: t };
  m = take(new RegExp(`\\b(?:(this|next|coming)\\s+)?(${DAYS.join("|")})\\b`));
  if (m) {
    const target = DAYS.indexOf(m[2]);
    let delta = (target - dow(today) + 7) % 7;
    if (m[1] === "next" && delta === 0) delta = 7;
    return { date: addDays(today, delta), rest: t };
  }
  const year = Number(today.slice(0, 4));
  const build = (day: number, mon: number) => {
    let y = year;
    if (!validYmd(y, mon, day)) return undefined;
    if (ymd(y, mon, day) < today) y += 1;
    return validYmd(y, mon, day) ? ymd(y, mon, day) : undefined;
  };
  m = take(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?${MON_RE}\\b`));
  if (m) {
    const d = build(+m[1], monthIndex(m[2]));
    if (d) return { date: d, rest: t };
  }
  m = take(new RegExp(`\\b${MON_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  if (m) {
    const d = build(+m[2], monthIndex(m[1]));
    if (d) return { date: d, rest: t };
  }
  return { rest: t };
}

/** "8 pm", "8:30pm", "20:00", "at 8", "noon" -> "HH:MM". Without am/pm the restaurant's own hours decide (1-6 and 7-10 mean pm). */
export function parseTimeWords(raw: string): { time?: string; rest: string } {
  const t = ` ${norm(raw)} `;
  const hhmm = (h: number, min: number) => (h >= 0 && h <= 23 && min >= 0 && min <= 59 ? `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}` : undefined);
  let m = t.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])/);
  if (m) {
    let h = +m[1];
    const pm = m[3].startsWith("p");
    if (h < 1 || h > 12) return { rest: t };
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    return { time: hhmm(h, m[2] ? +m[2] : 0), rest: t.replace(m[0], " ") };
  }
  m = t.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (m) return { time: hhmm(+m[1], +m[2]), rest: t.replace(m[0], " ") };
  if (/\b(?:noon|midday)\b/.test(t)) return { time: "12:00", rest: t.replace(/\b(?:noon|midday)\b/, " ") };
  m = t.match(/\bat (\d{1,2})(?:[.](\d{2}))?(?! ?(?:people|persons?|guests?|pax|of us))\b/);
  if (m) {
    let h = +m[1];
    if (h < 1 || h > 12) return { rest: t };
    if (h <= 10 && h !== 12) h += 12; // 1-10 -> afternoon/evening; 11 -> morning; 12 -> noon
    return { time: hhmm(h, m[2] ? +m[2] : 0), rest: t.replace(m[0], " ") };
  }
  return { rest: t };
}

/** "for 4", "party of 6", "4 people", "table for two". */
export function parsePartyWords(rest: string, bare = false): number | undefined {
  const t = ` ${norm(rest)} `;
  let m = t.match(new RegExp(`\\b(?:for|party of|group of|table of|seats? for)\\s+${NUM}\\b(?!\\s*(?:am|pm|a\\.m|p\\.m|:|\\.\\d|${MON_RE}|st|nd|rd|th))`));
  if (m) return toNum(m[1]);
  m = t.match(new RegExp(`\\b${NUM}\\s+(?:people|persons?|guests?|pax|adults|of us|diners)\\b`));
  if (m) return toNum(m[1]);
  if (bare) {
    m = t.match(new RegExp(`^\\s*${NUM}\\s*$`));
    if (m) return toNum(m[1]);
  }
  if (/\b(?:just me|only me|for myself|solo)\b/.test(t)) return 1;
  return undefined;
}

const CANCEL_WORD = /\b(cancel|delete|remove|undo|drop)\b/;
const BOOKING_NOUN = /\b(bookings?|reservations?|tables?|seats?)\b/;

const BARE_CANCEL = /^(?:(?:please|ok|okay|so|hey)\s+)*(?:(?:i (?:want|need|would like|wanna) to|i'd like to|let's|can you|could you)\s+)?(?:cancel|undo|delete|remove)(?: (?:it|that|this|the booking|my booking|that booking|the table|my table|the one i just made))?(?: please)?$/;

/** A bare "cancel it" / "cancel" (only meaningful right after a booking was made). */
export const isBareCancel = (text: string): boolean => BARE_CANCEL.test(norm(text));

export const isCancelBookingTalk = (text: string): boolean => {
  const t = norm(text);
  return !!t && t.length <= 200 && CANCEL_WORD.test(t) && BOOKING_NOUN.test(t) && !/\border\b/.test(t);
};

export const isBookTalk = (text: string): boolean => {
  const t = norm(text);
  if (!t || t.length > 200 || CANCEL_WORD.test(t)) return false;
  if (/\b(book|reserve|reserving|booking|reservation)\b/.test(t) && /\b(tables?|seats?|dinner|lunch|spot|reservation)\b/.test(t)) return true;
  if (/\breserve\b/.test(t)) return true;
  if (/\btables? for\b/.test(t) || /\b(?:get|find|need|want|have|got|looking for)\b.*\btable\b/.test(t)) return true;
  return false;
};

/** Does this message belong to the table-booking flow (so it must be allowed even before a table exists)? */
export const looksLikeBookingTalk = (text: string): boolean => isBookTalk(text) || isCancelBookingTalk(text);

function fieldsOf(text: string, today: string, bare: boolean): BookingFields {
  const d = parseDateWords(text, today);
  const tm = parseTimeWords(d.rest);
  const party = parsePartyWords(tm.rest, bare);
  return { ...(d.date ? { date: d.date } : {}), ...(tm.time ? { time: tm.time } : {}), ...(party !== undefined ? { party } : {}) };
}

/**
 * Work out what the customer wants from their recent messages (oldest first). `asked` says the waiter's previous message was
 * a "which day / how many people" question or a "which booking" question, so a short answer ("4 people tomorrow at 8") counts.
 */
export function resolveBookingRequest(userTexts: string[], asked: BookingAsk, today = todayLocal(), justBooking = false): BookingRequest | null {
  const texts = userTexts.slice(-6);
  const last = texts.at(-1) ?? "";
  if (!last) return null;

  // Right after a booking was offered or made, a bare "cancel it" / "cancel that" means that booking.
  if (justBooking && BARE_CANCEL.test(norm(last))) return { kind: "cancel" };

  if (isCancelBookingTalk(last) || asked === "cancel") {
    const f = fieldsOf(last, today, false);
    if (asked === "cancel" && !isCancelBookingTalk(last) && !f.date && !f.time) return null;
    return { kind: "cancel", ...(f.date ? { date: f.date } : {}), ...(f.time ? { time: f.time } : {}) };
  }

  let start = -1;
  texts.forEach((t, i) => {
    if (isBookTalk(t)) start = i;
  });
  if (start === -1 && asked === "book") start = texts.length - 1;
  if (start === -1) return null;
  if (!isBookTalk(last) && asked !== "book") return null; // an unrelated message must never continue an old booking

  const merged: BookingFields = {};
  texts.slice(start).forEach((t, i, arr) => Object.assign(merged, fieldsOf(t, today, asked === "book" && i === arr.length - 1)));
  return { kind: "book", ...merged };
}

/** Which question did the waiter just ask? Read from its last message. */
export function askedFrom(assistantText: string | undefined): BookingAsk {
  const t = (assistantText ?? "").toLowerCase();
  if (t.includes(BOOKING_ASK_MARKER)) return "book";
  if (t.includes(CANCEL_ASK_MARKER)) return "cancel";
  return null;
}

/** The text a time-slot button sends. It parses back to exactly the same request. */
export const bookRequestText = (party: number, date: string, time: string) => `Book a table for ${party} on ${date} at ${time}`;
export const cancelBookingText = (date: string, time: string) => `Cancel my booking on ${date} at ${time}`;

export const SEATING_HOURS = `lunch ${BOOKING.seatings[0]} to ${BOOKING.seatings[5]} and dinner ${BOOKING.seatings[6]} to ${BOOKING.seatings[13]}`;
