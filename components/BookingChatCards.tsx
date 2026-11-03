"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { BOOKING, formatDate, formatTime, type BookingRef } from "@/lib/booking";
import { bookRequestText } from "@/lib/bookingIntent";
import { AddToCalendar } from "./AddToCalendar";

// Events that let a spoken "yes" / "no" press the same buttons as a tap. The chat decides WHICH card is waiting.
export const BOOKING_CONFIRM_EVENT = "spice:booking-confirm";
export const BOOKING_DISMISS_EVENT = "spice:booking-dismiss";
export const BOOKING_SETTLED_EVENT = "spice:booking-settled";

const settle = (key: string) => window.dispatchEvent(new CustomEvent(BOOKING_SETTLED_EVENT, { detail: { key } }));

function useVoiceHooks(callKey: string, confirm: () => void, dismiss: () => void) {
  useEffect(() => {
    const on = (fn: () => void) => (e: Event) => {
      if ((e as CustomEvent<{ key: string }>).detail?.key === callKey) fn();
    };
    const c = on(confirm);
    const d = on(dismiss);
    window.addEventListener(BOOKING_CONFIRM_EVENT, c);
    window.addEventListener(BOOKING_DISMISS_EVENT, d);
    return () => {
      window.removeEventListener(BOOKING_CONFIRM_EVENT, c);
      window.removeEventListener(BOOKING_DISMISS_EVENT, d);
    };
  }, [callKey, confirm, dismiss]);
}

/** "I can seat 4 on Sat at 8 pm": the customer confirms with the button (or says yes), which calls the normal booking API. */
export function BookingOffer({ callKey, date, time, party }: { callKey: string; date: string; time: string; party: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "dismissed">("idle");
  const [done, setDone] = useState<BookingRef | null>(null);
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const confirm = useCallback(async () => {
    if (inFlight.current || done) return;
    inFlight.current = true;
    setState("busy");
    setError("");
    try {
      const r = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, time, party, notes: "" }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setError(j.error || "Sorry, we couldn't book that. Please try again.");
        setState("idle");
        if (r.status !== 429 && r.status !== 500) settle(callKey); // a refusal ("full", "limit") ends this offer; a glitch can be retried
      } else {
        setDone(j.booking);
        settle(callKey);
        router.refresh();
      }
    } catch {
      setError("Network problem. Please try again.");
      setState("idle");
    } finally {
      inFlight.current = false;
    }
  }, [date, time, party, done, callKey, router]);

  const dismiss = useCallback(() => {
    if (done || inFlight.current) return;
    setState("dismissed");
    settle(callKey);
  }, [done, callKey]);

  useVoiceHooks(callKey, confirm, dismiss);

  if (done) {
    return (
      <div role="status" className="rounded-xl border border-gold/30 bg-[#fff1ee] p-4" data-testid="chat-booking-done">
        <p className="font-display text-gold-soft">Your table is booked</p>
        <p className="mt-1 text-sm text-ivory">
          {formatDate(done.date)} at <strong>{formatTime(done.time)}</strong> · party of {done.party} · table {done.table}
        </p>
        <p className="mt-1 text-xs text-muted">
          Booking <span className="font-mono">{done.id}</span>. Free cancellation until {BOOKING.cancelCutoffMin / 60} hours before. Say &ldquo;cancel my booking&rdquo; any time.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link href={`/order?mode=dining&booking=${done.id}`} className="btn-gold px-4 py-1.5 text-sm">
            Pre-order your food
          </Link>
          <AddToCalendar booking={done} />
        </div>
      </div>
    );
  }
  if (state === "dismissed") return <p className="rounded-xl border border-line bg-panel2 p-3 text-sm text-muted">Okay, I haven&apos;t booked anything.</p>;

  return (
    <div className="rounded-xl border border-line bg-panel2 p-4" data-testid="chat-booking-offer">
      <p className="text-sm text-ivory">
        Book a table for <strong>{party}</strong> on <strong>{formatDate(date)}</strong> at <strong>{formatTime(time)}</strong>?
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button type="button" disabled={state === "busy"} onClick={confirm} className="btn-gold px-4 py-1.5 text-sm">
          {state === "busy" ? "Booking…" : "Yes, book this table"}
        </button>
        <button type="button" disabled={state === "busy"} onClick={dismiss} className="text-sm text-muted hover:text-ivory">
          No thanks
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/** One upcoming booking offered for cancelling. Cancelling goes through the normal cancel API (own bookings, 2-hour cut-off). */
export function BookingCancelOffer({ callKey, booking, allowed, message, single }: { callKey: string; booking: Pick<BookingRef, "id" | "date" | "time" | "party" | "table">; allowed: boolean; message: string; single: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done" | "dismissed">("idle");
  const [error, setError] = useState("");
  const inFlight = useRef(false);

  const confirm = useCallback(async () => {
    if (inFlight.current || state === "done" || !allowed) return;
    inFlight.current = true;
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
        settle(callKey);
        router.refresh();
      }
    } catch {
      setError("Network problem. Please try again.");
      setState("idle");
    } finally {
      inFlight.current = false;
    }
  }, [allowed, booking.id, callKey, router, state]);

  const dismiss = useCallback(() => {
    if (state === "done" || inFlight.current) return;
    setState("dismissed");
    settle(callKey);
  }, [state, callKey]);

  // A spoken "yes" only acts when exactly one booking is on offer; with several, the customer taps the one they mean.
  useVoiceHooks(callKey, single ? confirm : () => undefined, dismiss);

  const label = `${formatDate(booking.date)} · ${formatTime(booking.time)} · party of ${booking.party} · table ${booking.table}`;
  if (state === "done")
    return (
      <div role="status" className="rounded-xl border border-gold/30 bg-[#fff1ee] p-4" data-testid="chat-cancel-done">
        <p className="font-display text-gold-soft">Booking cancelled</p>
        <p className="mt-1 text-sm text-ivory">{label}. The table is free again.</p>
      </div>
    );
  if (state === "dismissed") return <p className="rounded-xl border border-line bg-panel2 p-3 text-sm text-muted">Okay, I&apos;ve kept your booking.</p>;

  return (
    <div className="rounded-xl border border-line bg-panel2 p-4" data-testid="chat-cancel-offer">
      <p className="text-sm text-ivory">{label}</p>
      {allowed ? (
        <div className="mt-2 flex items-center gap-3">
          <button type="button" disabled={state === "busy"} onClick={confirm} className="btn-gold px-4 py-1.5 text-sm">
            {state === "busy" ? "Cancelling…" : "Yes, cancel this booking"}
          </button>
          <button type="button" disabled={state === "busy"} onClick={dismiss} className="text-sm text-muted hover:text-ivory">
            Keep it
          </button>
        </div>
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

/** Free times as buttons. Tapping one asks for exactly that booking, which brings up the confirm button. */
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
