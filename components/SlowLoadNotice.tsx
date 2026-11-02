"use client";

import { useEffect, useState } from "react";

/**
 * Rarely, the hosting platform takes ~20 seconds to answer a request. A new request almost always succeeds at once, so
 * after a few seconds of waiting we say so and offer a one-tap retry instead of leaving the visitor staring at a skeleton.
 */
export function SlowLoadNotice({ afterMs = 6000 }: { afterMs?: number }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), afterMs);
    return () => clearTimeout(t);
  }, [afterMs]);

  if (!slow) return <p className="pb-4 text-center text-sm text-muted">Setting your table…</p>;
  return (
    <div className="pb-6 text-center" role="alert">
      <p className="text-sm font-semibold text-ivory">This is taking longer than usual.</p>
      <button type="button" onClick={() => window.location.reload()} className="btn-gold mt-2 px-6 py-2.5 text-sm">
        Try again
      </button>
    </div>
  );
}
