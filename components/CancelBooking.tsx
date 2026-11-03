"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BOOKING, cancelCheck, type BookingRef } from "@/lib/booking";

/** Two-tap "Cancel booking" for the dining screen. The server decides whether cancelling is still allowed. */
export function CancelBooking({ booking, onCancelled }: { booking: BookingRef; onCancelled?: () => void }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());

  if (!cancelCheck(booking, now).ok)
    return <span className="text-xs text-muted">Within {BOOKING.cancelCutoffMin / 60} hours: please call the restaurant to change this.</span>;

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/bookings/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: booking.id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setError(j.error || "Sorry, we couldn't cancel that booking. Please try again.");
        setBusy(false);
        setAsking(false);
        return;
      }
      onCancelled?.();
      router.refresh(); // the page re-reads the bookings, so the cancelled one disappears
    } catch {
      setError("Network problem. Please try again.");
      setBusy(false);
      setAsking(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
      {asking ? (
        <>
          <button type="button" disabled={busy} onClick={cancel} className="btn-gold px-4 py-2 text-sm">
            {busy ? "Cancelling…" : "Yes, cancel booking"}
          </button>
          <button type="button" disabled={busy} onClick={() => setAsking(false)} className="px-2 py-2.5 text-sm text-muted hover:text-ivory">
            Keep it
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setAsking(true)} className="px-1 py-2.5 text-sm font-semibold text-red-700 hover:underline">
          Cancel booking
        </button>
      )}
      {error && (
        <span role="alert" className="w-full text-sm font-semibold text-red-700">
          {error}
        </span>
      )}
    </span>
  );
}
