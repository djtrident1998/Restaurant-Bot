"use client";

import Link from "next/link";
import type { ServiceType } from "@/lib/service";

/** Step one of ordering: Delivery or Dining. Shown first, before the menu, until the customer has chosen. */
export function StartChoice({ onPick }: { onPick: (type: ServiceType) => void }) {
  return (
    <div data-testid="start-choice">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-soft">Step 1</p>
      <h2 className="font-display mt-1 text-2xl text-ivory sm:text-3xl">How would you like to enjoy Spice Route?</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onPick("delivery")}
          className="group rounded-2xl border-2 border-line bg-panel p-5 text-left transition hover:-translate-y-0.5 hover:border-gold hover:shadow-lg focus-visible:border-gold"
        >
          <span className="text-4xl" aria-hidden>
            🛵
          </span>
          <span className="font-display mt-2 block text-xl text-ivory">Delivery</span>
          <span className="mt-1 block text-sm text-muted">Order from our menu with the AI waiter and have it brought to you.</span>
          <span className="mt-3 inline-block text-sm font-bold text-gold-soft group-hover:underline">Choose delivery →</span>
        </button>
        <button
          type="button"
          onClick={() => onPick("dine-in")}
          className="group rounded-2xl border-2 border-line bg-panel p-5 text-left transition hover:-translate-y-0.5 hover:border-gold hover:shadow-lg focus-visible:border-gold"
        >
          <span className="text-4xl" aria-hidden>
            🍽
          </span>
          <span className="font-display mt-2 block text-xl text-ivory">Dining</span>
          <span className="mt-1 block text-sm text-muted">Eat at the restaurant. Book a table, and pre-order so your food is ready.</span>
          <span className="mt-3 inline-block text-sm font-bold text-gold-soft group-hover:underline">Choose dining →</span>
        </button>
      </div>
      <p className="mt-3 text-sm text-muted">
        Just want a table?{" "}
        <Link href="/book" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
          Book a table
        </Link>
        . You can switch between Delivery and Dining at any time.
      </p>
    </div>
  );
}
