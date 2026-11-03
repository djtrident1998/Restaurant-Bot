"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BOOKING, cancelCheck, formatDate, formatTime, isUpcoming, type BookingRef } from "@/lib/booking";
import { AddToCalendar } from "./AddToCalendar";

/** The customer's table bookings, upcoming first, with a two-tap cancel (the server decides whether it is still allowed). */
export function BookingsList({ bookings }: { bookings: BookingRef[] }) {
  const router = useRouter();
  const [asking, setAsking] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function cancel(id: string) {
    setBusy(id);
    setError("");
    try {
      const r = await fetch("/api/bookings/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) setError(j.error || "Sorry, we couldn't cancel that booking. Please try again.");
      else router.refresh();
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setBusy(null);
      setAsking(null);
    }
  }

  const [now] = useState(() => Date.now()); // fixed for this render pass (upcoming vs past)
  const sorted = [...bookings].sort((a, b) => {
    const au = isUpcoming(a, now), bu = isUpcoming(b, now);
    if (au !== bu) return au ? -1 : 1;
    const ka = a.date + a.time, kb = b.date + b.time;
    return au ? ka.localeCompare(kb) : kb.localeCompare(ka);
  });

  if (sorted.length === 0)
    return (
      <div className="card mt-4 p-5 text-muted">
        No table bookings yet.{" "}
        <Link href="/book" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
          Book a table
        </Link>
        .
      </div>
    );

  return (
    <div className="mt-4">
      <ul className="space-y-3">
        {sorted.map((b) => {
          const up = isUpcoming(b, now);
          const c = cancelCheck(b, now);
          return (
            <li key={b.id} className={`card p-4 ${up ? "" : "opacity-70"}`} data-testid="booking-row">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-ivory">
                  {formatDate(b.date)} · {formatTime(b.time)} · party of {b.party}
                </p>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${b.status === "cancelled" ? "bg-red-100 text-red-800" : up ? "bg-green-100 text-green-900" : "bg-panel2 text-muted"}`}>
                  {b.status === "cancelled" ? "Cancelled" : up ? "Confirmed" : "Past"}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted">
                Table {b.table} · <span className="font-mono">{b.id}</span>
                {b.notes ? ` · “${b.notes}”` : ""}
              </p>
              {up && (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link href={`/order?mode=dining&booking=${b.id}`} className="btn-ghost px-4 py-2 text-sm">
                    Pre-order food
                  </Link>
                  <AddToCalendar booking={b} />
                  {asking === b.id ? (
                    <>
                      <button type="button" disabled={busy === b.id} onClick={() => cancel(b.id)} className="btn-gold px-4 py-2 text-sm">
                        {busy === b.id ? "Cancelling…" : "Yes, cancel booking"}
                      </button>
                      <button type="button" disabled={busy === b.id} onClick={() => setAsking(null)} className="px-2 py-2.5 text-sm text-muted hover:text-ivory">
                        Keep it
                      </button>
                    </>
                  ) : c.ok ? (
                    <button type="button" onClick={() => setAsking(b.id)} className="px-2 py-2.5 text-sm font-semibold text-red-700 hover:underline">
                      Cancel booking
                    </button>
                  ) : (
                    <span className="text-xs text-muted">Within {BOOKING.cancelCutoffMin / 60} hours: please call the restaurant to change this.</span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && (
        <p role="alert" className="mt-3 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
