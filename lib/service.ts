// How the customer wants to enjoy the order: DELIVERY (the existing ordering flow) or DINING (dine in, optionally tied to a
// table booking). Browser-safe. The selection travels with every chat request and is validated on the server.
import { BOOKING_ID_RE, formatDate, formatTime, isUpcoming, type BookingRef } from "./booking";

export type ServiceType = "delivery" | "dine-in";

export interface Service {
  type: ServiceType;
  /** Dine-in only: one of the customer's own upcoming bookings, so the kitchen knows which table the order is for. */
  bookingId?: string;
}

export const DEFAULT_SERVICE: Service = { type: "delivery" };

export const SERVICE_NAME: Record<ServiceType, string> = { delivery: "Delivery", "dine-in": "Dining" };

/** Lenient parse for something arriving from the browser: anything unexpected falls back to delivery with no booking. */
export function parseService(raw: unknown): Service {
  const r = (raw ?? {}) as { type?: unknown; bookingId?: unknown };
  if (r.type !== "dine-in") return { ...DEFAULT_SERVICE };
  const id = typeof r.bookingId === "string" ? r.bookingId.trim().toUpperCase() : "";
  return BOOKING_ID_RE.test(id) ? { type: "dine-in", bookingId: id } : { type: "dine-in" };
}

/** The booking must be one of the customer's OWN, still ahead of us; otherwise it is dropped (the order is a walk-in). */
export function validateService(s: Service, bookings: BookingRef[] | undefined, now = Date.now()): Service {
  if (s.type !== "dine-in" || !s.bookingId) return s;
  const ok = (bookings ?? []).some((b) => b.id === s.bookingId && isUpcoming(b, now));
  return ok ? s : { type: "dine-in" };
}

/** "Delivery", "Dining — walk-in", or "Dining — table booked Thu, 5 Nov at 7:30 pm (T5)". */
export function serviceLabel(s: Service, bookings?: BookingRef[]): string {
  if (s.type === "delivery") return "Delivery";
  const b = s.bookingId ? (bookings ?? []).find((x) => x.id === s.bookingId) : undefined;
  if (b) return `Dining — table booked ${formatDate(b.date)} at ${formatTime(b.time)} (${b.table})`;
  return s.bookingId ? `Dining — booking ${s.bookingId}` : "Dining — walk-in";
}

/** Short form for cards and invoices. */
export function serviceShort(s: Service | undefined): string {
  if (!s) return "";
  return s.type === "delivery" ? "Delivery" : s.bookingId ? `Dine in · booking ${s.bookingId}` : "Dine in";
}
