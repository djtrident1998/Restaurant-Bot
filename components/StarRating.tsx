"use client";

import { useState } from "react";

const LABELS = ["", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** 1-5 star control (a radio group, so it works with keyboard and screen readers). `readOnly` just displays a rating. */
export function StarRating({ value, onChange, readOnly = false, size = "text-3xl" }: { value: number; onChange?: (n: number) => void; readOnly?: boolean; size?: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  if (readOnly) {
    return (
      <span className={`inline-flex gap-0.5 ${size === "text-3xl" ? "text-lg" : size}`} role="img" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= value ? "text-amber-400" : "text-neutral-300"} aria-hidden>
            ★
          </span>
        ))}
      </span>
    );
  }

  return (
    <div>
      <div role="radiogroup" aria-label="Rate your meal from 1 to 5 stars" className="inline-flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""} — ${LABELS[n]}`}
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(n)}
            onBlur={() => setHover(0)}
            onClick={() => onChange?.(n)}
            className={`${size} px-0.5 py-1.5 leading-none transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${n <= shown ? "text-amber-400" : "text-neutral-300"}`}
          >
            ★
          </button>
        ))}
      </div>
      <p className="mt-1 h-4 text-xs text-muted" aria-live="polite">
        {shown ? LABELS[shown] : "Tap a star"}
      </p>
    </div>
  );
}
