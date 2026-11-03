"use client";

import Link from "next/link";
import { formatDate, formatTime, type BookingRef } from "@/lib/booking";
import type { Service, ServiceType } from "@/lib/service";
import { CancelBooking } from "./CancelBooking";

/**
 * Delivery or Dining: a clear either/or at the top of the ordering screen. Delivery is the existing ordering flow.
 * Dining orders can be tied to one of the customer's upcoming table bookings. The choice is validated on the server.
 */
export function ServiceBar({ service, onChange, bookings, signedIn, compact = false }: { service: Service; onChange: (s: Service) => void; bookings: BookingRef[]; signedIn: boolean; compact?: boolean }) {
  const selected = service.type === "dine-in" ? bookings.find((b) => b.id === service.bookingId) : undefined;
  const pick = (type: ServiceType) => onChange(type === "delivery" ? { type } : { type, bookingId: service.type === "dine-in" ? service.bookingId : undefined });

  return (
    <div className="mb-3" data-testid="service-bar">
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-panel2 p-1" role="group" aria-label="How would you like your order?">
        {(
          [
            { type: "delivery", emoji: "🛵", label: "Delivery", sub: "To your door" },
            { type: "dine-in", emoji: "🍽", label: "Dining", sub: "Eat at the restaurant" },
          ] as const
        ).map((o) => {
          const on = service.type === o.type;
          return (
            <button
              key={o.type}
              type="button"
              aria-pressed={on}
              onClick={() => pick(o.type)}
              className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-left transition ${on ? "bg-panel shadow-md ring-2 ring-gold" : "text-muted hover:bg-panel/60"}`}
            >
              <span className="text-xl" aria-hidden>
                {o.emoji}
              </span>
              <span className="min-w-0">
                <span className={`block text-sm font-bold ${on ? "text-ivory" : ""}`}>{o.label}</span>
                <span className="hidden text-xs text-muted sm:block">{o.sub}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* `compact`: the booking gate below already offers the table choice or "Book a table", so don't repeat it here. */}
      {service.type === "dine-in" && !compact && (
        <div className="mt-2 rounded-xl border border-line bg-panel px-3 py-2.5 text-sm">
          {!signedIn ? (
            <p className="text-muted">
              <Link href="/login" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
                Sign in
              </Link>{" "}
              to book a table. Once it&apos;s booked, you can pre-order your food.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 font-semibold text-ivory">Table</span>
                <select
                  value={service.bookingId ?? ""}
                  onChange={(e) => onChange({ type: "dine-in", bookingId: e.target.value || undefined })}
                  className="min-w-0 flex-1 rounded-lg border border-line bg-panel2 px-2 py-2 text-base text-ivory"
                >
                  <option value="" disabled>
                    Choose your booking…
                  </option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {formatDate(b.date)} · {formatTime(b.time)} · party of {b.party}
                    </option>
                  ))}
                </select>
              </label>
              <Link href="/book" className="btn-ghost shrink-0 px-4 py-2 text-sm font-semibold">
                Book a table
              </Link>
              {selected && <CancelBooking booking={selected} onCancelled={() => onChange({ type: "dine-in" })} />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
