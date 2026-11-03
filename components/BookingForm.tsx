"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BOOKING, addDays, formatDate, formatTime, type BookingRef, type SlotStatus } from "@/lib/booking";
import { AddToCalendar } from "./AddToCalendar";

const LUNCH = BOOKING.seatings.filter((t) => t < "17:00");
const DINNER = BOOKING.seatings.filter((t) => t >= "17:00");
const REASON: Record<string, string> = { full: "Full", "too-soon": "Too soon", party: "—" };

function dayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === addDays(today, 1)) return "Tomorrow";
  return formatDate(date);
}

/** Book a table: date, party size, a free time (checked live against the real tables), notes, confirm. */
export function BookingForm({
  today,
  signedIn,
  upcomingCount,
  initial = {},
}: {
  today: string;
  signedIn: boolean;
  upcomingCount: number;
  /** Prefilled from the landing page's "Find a table" search (already validated on the server). */
  initial?: { date?: string; party?: number; time?: string };
}) {
  const maxDate = addDays(today, BOOKING.maxDaysAhead);
  const chips = useMemo(() => Array.from({ length: 8 }, (_, i) => addDays(today, i)), [today]);
  const [date, setDate] = useState(initial.date ?? today);
  const [party, setParty] = useState(initial.party ?? 2);
  const [time, setTime] = useState(initial.time ?? "");
  const [notes, setNotes] = useState("");
  const [data, setData] = useState<{ key: string; slots: SlotStatus[]; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<BookingRef | null>(null);

  const key = `${date}|${party}`;
  const loading = !data || data.key !== key;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bookings/availability?date=${date}&party=${party}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled) setData({ key: `${date}|${party}`, slots: j.ok ? j.slots : [], error: j.ok ? undefined : j.error });
      })
      .catch(() => {
        if (!cancelled) setData({ key: `${date}|${party}`, slots: [], error: "Couldn't check availability. Please try again." });
      });
    return () => {
      cancelled = true;
    };
  }, [date, party]);

  const slotMap = new Map((data && data.key === key ? data.slots : []).map((s) => [s.time, s]));
  const chosen = slotMap.get(time);
  const canSubmit = signedIn && !!chosen?.available && !busy && upcomingCount < BOOKING.maxActivePerUser;

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, time, party, notes }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setError(j.error || "Sorry, we couldn't book that. Please try again.");
        setTime(""); // the slot may have just filled: refresh what's shown
        setData(null);
        setDate((d) => d); // no-op, effect re-runs below via key change
        fetch(`/api/bookings/availability?date=${date}&party=${party}`).then((x) => x.json()).then((y) => setData({ key, slots: y.ok ? y.slots : [] })).catch(() => {});
      } else setDone(j.booking);
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card p-6 text-center" role="status" data-testid="booking-done">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[var(--veg)] text-2xl text-white" aria-hidden>
          ✓
        </div>
        <h2 className="font-display mt-3 text-2xl text-ivory">Your table is booked</h2>
        <p className="mt-1 text-ivory">
          {formatDate(done.date)} at <strong>{formatTime(done.time)}</strong> · party of {done.party} · table {done.table}
        </p>
        <p className="mt-1 text-sm text-muted">
          Booking <span className="font-mono font-semibold text-ivory">{done.id}</span>. Free cancellation until {BOOKING.cancelCutoffMin / 60} hours before. We hold your table for {BOOKING.holdMin} minutes after your booking time.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/order?mode=dining" className="btn-gold px-6 py-3 text-sm">
            Pre-order your food
          </Link>
          <AddToCalendar booking={done} />
          <Link href="/account#bookings" className="btn-ghost px-6 py-3 text-sm">
            View my bookings
          </Link>
        </div>
      </div>
    );
  }

  const group = (title: string, times: string[]) => (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">{title}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        {times.map((t) => {
          const s = slotMap.get(t);
          const ok = !!s?.available;
          const on = time === t;
          return (
            <button
              key={t}
              type="button"
              disabled={loading || !ok}
              aria-pressed={on}
              onClick={() => setTime(t)}
              className={`rounded-xl border px-2 py-2.5 text-sm font-semibold transition ${on ? "border-gold bg-gold text-white" : ok ? "border-line bg-panel text-ivory hover:border-gold" : "border-line bg-panel2 text-muted/60"}`}
            >
              {formatTime(t)}
              {!loading && s && !ok && <span className="block text-[10px] font-medium uppercase tracking-wide">{REASON[s.reason ?? "full"]}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="card space-y-6 p-5 sm:p-6">
      <section aria-labelledby="bk-date">
        <h2 id="bk-date" className="font-display text-lg text-ivory">
          1 · Choose a date
        </h2>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {chips.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={date === d}
              onClick={() => {
                setDate(d);
                setTime("");
              }}
              className={`shrink-0 rounded-xl border px-4 py-2.5 text-sm font-semibold ${date === d ? "border-gold bg-gold text-white" : "border-line bg-panel text-ivory hover:border-gold"}`}
            >
              {dayLabel(d, today)}
            </button>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-3 text-sm text-muted">
          Or another date
          <input
            type="date"
            min={today}
            max={maxDate}
            value={date}
            onChange={(e) => {
              if (e.target.value) {
                setDate(e.target.value);
                setTime("");
              }
            }}
            className="rounded-lg border border-line bg-panel2 px-3 py-2 text-base text-ivory"
          />
        </label>
      </section>

      <section aria-labelledby="bk-party">
        <h2 id="bk-party" className="font-display text-lg text-ivory">
          2 · How many people?
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center rounded-xl border border-line" role="group" aria-label="Party size">
            <button type="button" aria-label="One fewer person" disabled={party <= 1} onClick={() => { setParty((p) => p - 1); setTime(""); }} className="h-11 w-11 text-xl font-bold text-gold-soft hover:bg-gold/10 disabled:opacity-40">
              −
            </button>
            <span className="min-w-10 text-center text-lg font-bold text-ivory" aria-live="polite">
              {party}
            </span>
            <button type="button" aria-label="One more person" disabled={party >= BOOKING.maxParty} onClick={() => { setParty((p) => p + 1); setTime(""); }} className="h-11 w-11 text-xl font-bold text-gold-soft hover:bg-gold/10 disabled:opacity-40">
              +
            </button>
          </div>
          <p className="text-sm text-muted">
            Parties of 1–{BOOKING.maxParty} can book online. Planning for more? Larger groups need a call to the restaurant, so we can arrange tables together.
          </p>
        </div>
      </section>

      <section aria-labelledby="bk-time" aria-busy={loading}>
        <h2 id="bk-time" className="font-display text-lg text-ivory">
          3 · Pick a time
        </h2>
        <div className="mt-3 space-y-4">
          {data?.error && !loading ? (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {data.error}
            </p>
          ) : (
            <>
              {group("Lunch", LUNCH)}
              {group("Dinner", DINNER)}
            </>
          )}
          {loading && <p className="text-sm text-muted">Checking tables…</p>}
        </div>
      </section>

      <section aria-labelledby="bk-notes">
        <h2 id="bk-notes" className="font-display text-lg text-ivory">
          4 · Anything we should know? <span className="text-sm font-normal text-muted">(optional)</span>
        </h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={BOOKING.notesMax}
          rows={2}
          placeholder="Birthday, high chair, a quiet table…"
          className="mt-3 w-full resize-none rounded-xl border border-line bg-panel2 px-3 py-2 text-base text-ivory outline-none focus:border-gold"
        />
        <p className="text-right text-xs text-muted">
          {notes.length}/{BOOKING.notesMax}
        </p>
        <p className="text-xs text-muted">Please don&apos;t put medical details here. For serious allergies, tell the restaurant directly.</p>
      </section>

      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      {upcomingCount >= BOOKING.maxActivePerUser && (
        <p role="note" className="text-sm font-semibold text-red-700">
          You already have {BOOKING.maxActivePerUser} upcoming bookings. Cancel one on your account page to make another.
        </p>
      )}

      {signedIn ? (
        <button type="button" disabled={!canSubmit} onClick={submit} className="btn-gold w-full px-6 py-3.5 text-base">
          {busy ? "Booking…" : chosen?.available ? `Confirm: ${formatDate(date)} · ${formatTime(time)} · ${party} ${party === 1 ? "person" : "people"}` : "Choose a time to continue"}
        </button>
      ) : (
        <div className="rounded-xl bg-panel2 p-4 text-center text-sm">
          <p className="text-ivory">Sign in to confirm your table.</p>
          <div className="mt-2 flex justify-center gap-3">
            <Link href="/login" className="btn-gold px-5 py-2 text-sm">
              Sign in
            </Link>
            <Link href="/signup" className="btn-ghost px-5 py-2 text-sm">
              Create account
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
