"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BOOKING, addDays, formatTime, todayLocal } from "@/lib/booking";

type Mode = "delivery" | "dining";

/**
 * The very first choice on the page: Delivery or Dining. The panel below changes with it (like the big food apps, the screen
 * looks different per mode so people always know which they are in). Delivery leads straight to the AI waiter; Dining
 * is a "find a table" search that prefills the booking page.
 */
export function HeroChoice() {
  const [mode, setMode] = useState<Mode>("delivery");
  const [today, setToday] = useState("");
  const [date, setDate] = useState("");
  const [party, setParty] = useState(2);
  const [time, setTime] = useState("");

  useEffect(() => {
    // The restaurant's "today" depends on the clock, so it is read after mount (the page itself is served statically).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(todayLocal());
  }, []);

  const params = new URLSearchParams();
  if (date) params.set("date", date);
  params.set("party", String(party));
  if (time) params.set("time", time);

  return (
    <div className="fade-up mt-9 w-full max-w-xl [animation-delay:380ms]" data-testid="hero-choice">
      <div className="grid grid-cols-2 gap-1 rounded-full border border-white/25 bg-white/10 p-1 backdrop-blur" role="group" aria-label="How would you like to enjoy Spice Route?">
        {(
          [
            { m: "delivery", emoji: "🛵", label: "Delivery" },
            { m: "dining", emoji: "🍽", label: "Dining" },
          ] as const
        ).map((o) => (
          <button
            key={o.m}
            type="button"
            aria-pressed={mode === o.m}
            onClick={() => setMode(o.m)}
            className={`flex items-center justify-center gap-2 rounded-full px-4 py-3 text-base font-bold transition ${mode === o.m ? "bg-white text-[#1c1c28] shadow-lg" : "text-white hover:bg-white/10"}`}
          >
            <span aria-hidden>{o.emoji}</span>
            {o.label}
          </button>
        ))}
      </div>

      <div className="mt-5" aria-live="polite">
        {mode === "delivery" ? (
          <div data-testid="hero-delivery" className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link href="/order?mode=delivery" className="btn-gold px-9 py-3.5 text-base">
              Order with our AI waiter
            </Link>
            <Link href="#signature" className="btn-ghost bg-white/10 px-9 py-3.5 text-base text-white backdrop-blur">
              Discover the menu
            </Link>
          </div>
        ) : (
          <div data-testid="hero-dining" className="rounded-2xl border border-white/25 bg-black/30 p-4 text-left backdrop-blur">
            <p className="text-sm font-bold text-white">Find a table</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="col-span-2 text-xs font-semibold uppercase tracking-wide text-white/80 sm:col-span-1">
                Date
                <input
                  type="date"
                  value={date}
                  min={today || undefined}
                  max={today ? addDays(today, BOOKING.maxDaysAhead) : undefined}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2.5 text-base font-normal normal-case text-white [color-scheme:dark]"
                />
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-white/80">
                People
                <select value={party} onChange={(e) => setParty(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-white/30 bg-[#2a211b] px-3 py-2.5 text-base font-normal normal-case text-white">
                  {Array.from({ length: BOOKING.maxParty }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "person" : "people"}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold uppercase tracking-wide text-white/80">
                Time
                <select value={time} onChange={(e) => setTime(e.target.value)} className="mt-1 w-full rounded-lg border border-white/30 bg-[#2a211b] px-3 py-2.5 text-base font-normal normal-case text-white">
                  <option value="">Any time</option>
                  {BOOKING.seatings.map((t) => (
                    <option key={t} value={t}>
                      {formatTime(t)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href={`/book?${params.toString()}`} className="btn-gold px-8 py-3 text-center text-base">
                Find a table
              </Link>
              <p className="text-center text-sm text-white/80 sm:text-left">Book first, then pre-order your food.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
