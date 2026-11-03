"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BOOKING, formatDate, formatTime, type BookingRef } from "@/lib/booking";
import { bookRequestText } from "@/lib/bookingIntent";
import { AddToCalendar } from "./AddToCalendar";

/** The chat has just booked a table (the request was clear, so it was done straight away). */
export function BookingDoneCard({ booking }: { booking: BookingRef }) {
  const router = useRouter();
  const refreshed = useRef(false);
  useEffect(() => {
    // Bring the page's own list of bookings up to date once (the Dining screen shows it).
    if (refreshed.current) return;
    refreshed.current = true;
    router.refresh();
  }, [router]);

  return (
    <div role="status" className="rounded-xl border border-gold/30 bg-[#fff1ee] p-4" data-testid="chat-booking-done">
      <p className="font-display text-gold-soft">Your table is booked</p>
      <p className="mt-1 text-sm text-ivory">
        {formatDate(booking.date)} at <strong>{formatTime(booking.time)}</strong> · party of {booking.party} · table {booking.table}
      </p>
      <p className="mt-1 text-xs text-muted">
        Booking <span className="font-mono">{booking.id}</span>. Free cancellation until {BOOKING.cancelCutoffMin / 60} hours before: just say &ldquo;cancel my booking&rdquo;.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link href={`/order?mode=dining&booking=${booking.id}`} className="btn-gold px-4 py-1.5 text-sm">
          Pre-order your food
        </Link>
        <AddToCalendar booking={booking} />
      </div>
    </div>
  );
}

/** The chat has cancelled a booking. */
export function BookingCancelledCard({ booking }: { booking: Pick<BookingRef, "date" | "time" | "party" | "table"> }) {
  const router = useRouter();
  const refreshed = useRef(false);
  useEffect(() => {
    if (refreshed.current) return;
    refreshed.current = true;
    router.refresh();
  }, [router]);

  return (
    <div role="status" className="rounded-xl border border-gold/30 bg-[#fff1ee] p-4" data-testid="chat-cancel-done">
      <p className="font-display text-gold-soft">Booking cancelled</p>
      <p className="mt-1 text-sm text-ivory">
        {formatDate(booking.date)} · {formatTime(booking.time)} · party of {booking.party} · table {booking.table}. The table is free again.
      </p>
    </div>
  );
}

/** The chat has cancelled an order and recorded the refund. */
export function OrderCancelledCard({ orderId, refund }: { orderId: string; refund: { amount: number; ref: string } }) {
  return (
    <div role="status" className="rounded-xl border border-gold/30 bg-[#fff1ee] p-4" data-testid="cancel-done">
      <p className="font-display text-gold-soft">Order {orderId} cancelled</p>
      <p className="mt-1 text-sm text-ivory/90">
        A full refund of <strong>₹{refund.amount}</strong> has been recorded (ref <span className="font-mono">{refund.ref}</span>).
      </p>
      <p className="mt-1 text-xs text-muted">Demo note: no online payment was taken for this order, so no money actually moves.</p>
    </div>
  );
}

/** Several bookings and none named: tap the one to cancel (or say its day or time). */
export function BookingCancelOffer({ booking, allowed, message }: { booking: Pick<BookingRef, "id" | "date" | "time" | "party" | "table">; allowed: boolean; message: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");

  async function cancel() {
    setState("busy");
    setError("");
    try {
      const r = await fetch("/api/bookings/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: booking.id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setError(j.error || "Sorry, we couldn't cancel that booking. Please try again.");
        setState("idle");
      } else {
        setState("done");
        router.refresh();
      }
    } catch {
      setError("Network problem. Please try again.");
      setState("idle");
    }
  }

  const label = `${formatDate(booking.date)} · ${formatTime(booking.time)} · party of ${booking.party} · table ${booking.table}`;
  if (state === "done")
    return (
      <div role="status" className="rounded-xl border border-gold/30 bg-[#fff1ee] p-4" data-testid="chat-cancel-done">
        <p className="font-display text-gold-soft">Booking cancelled</p>
        <p className="mt-1 text-sm text-ivory">{label}. The table is free again.</p>
      </div>
    );

  return (
    <div className="rounded-xl border border-line bg-panel2 p-4" data-testid="chat-cancel-offer">
      <p className="text-sm text-ivory">{label}</p>
      {allowed ? (
        <button type="button" disabled={state === "busy"} onClick={cancel} className="btn-ghost mt-2 px-4 py-1.5 text-sm">
          {state === "busy" ? "Cancelling…" : "Cancel this booking"}
        </button>
      ) : (
        <p className="mt-1 text-sm text-muted">{message}</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** Free times as buttons. Tapping one books exactly that time. */
export function BookingSlots({ date, party, times, onSend, disabled }: { date: string; party: number; times: string[]; onSend: (text: string) => void; disabled: boolean }) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="chat-booking-slots">
      {times.map((t) => (
        <button key={t} type="button" disabled={disabled} onClick={() => onSend(bookRequestText(party, date, t))} className="rounded-full border border-line bg-panel px-4 py-2 text-sm font-semibold text-ivory transition hover:border-gold hover:text-gold-soft disabled:opacity-50">
          {formatTime(t)}
        </button>
      ))}
    </div>
  );
}
