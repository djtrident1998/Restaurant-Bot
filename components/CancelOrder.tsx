"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Refund {
  amount: number;
  ref: string;
}

/**
 * Cancel an order and get a full refund. Two taps (Cancel -> Yes, cancel) so it can't happen by accident; the server
 * decides whether the order is still cancellable. `minutesLeft` is only a hint for the label.
 */
export function CancelOrder({ orderId, total, minutesLeft, refreshAfter = false }: { orderId: string; total: number; minutesLeft?: number; refreshAfter?: boolean }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [refund, setRefund] = useState<Refund | null>(null);

  async function cancel() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setError(j.error || "Sorry, we couldn't cancel this order. Please try again.");
        setAsking(false);
      } else {
        setRefund(j.refund);
        if (refreshAfter) router.refresh();
      }
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (refund) {
    return (
      <div role="status" className="rounded-xl border border-gold/50 bg-black/30 p-4" data-testid="cancel-done">
        <p className="font-display text-gold-soft">Order {orderId} cancelled</p>
        <p className="mt-1 text-sm text-ivory/90">
          A full refund of <strong>₹{refund.amount}</strong> has been recorded (ref <span className="font-mono">{refund.ref}</span>).
        </p>
        <p className="mt-1 text-xs text-muted">Demo note: no online payment was taken for this order, so no money actually moves.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-black/30 p-4">
      {!asking ? (
        <button type="button" onClick={() => setAsking(true)} className="btn-ghost px-4 py-1.5 text-sm">
          Cancel order &amp; refund{minutesLeft ? ` (${minutesLeft} min left)` : ""}
        </button>
      ) : (
        <div>
          <p className="text-sm text-ivory">
            Cancel order <span className="font-mono">{orderId}</span> and refund <strong>₹{total}</strong>?
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button type="button" disabled={busy} onClick={cancel} className="btn-gold px-4 py-1.5 text-sm">
              {busy ? "Cancelling…" : "Yes, cancel order"}
            </button>
            <button type="button" disabled={busy} onClick={() => setAsking(false)} className="text-sm text-muted hover:text-ivory">
              Keep my order
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
