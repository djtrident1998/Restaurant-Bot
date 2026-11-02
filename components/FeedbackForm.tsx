"use client";

import { useState } from "react";
import { MAX_COMMENT } from "@/lib/feedbackConstants";
import { StarRating } from "./StarRating";

interface Saved {
  rating: number;
  comment: string;
}

/** Rate an order (1-5 stars + optional comment). Saved to the signed-in customer's account; can be edited afterwards. */
export function FeedbackForm({ orderId, initial, title = "How was your meal?" }: { orderId: string; initial?: Saved; title?: string }) {
  const [saved, setSaved] = useState<Saved | undefined>(initial);
  const [editing, setEditing] = useState(!initial);
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [comment, setComment] = useState(initial?.comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) {
      setError("Please choose 1 to 5 stars.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, rating, comment }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setError(j.error || "Sorry, we couldn't save your feedback. Please try again.");
      } else {
        setSaved({ rating: j.feedback.rating, comment: j.feedback.comment });
        setEditing(false);
      }
    } catch {
      setError("Network problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (saved && !editing) {
    return (
      <div className="rounded-xl border border-line bg-black/30 p-4" data-testid="feedback-saved">
        <p className="font-display text-gold-soft">Thank you for your feedback</p>
        <div className="mt-1">
          <StarRating value={saved.rating} readOnly />
        </div>
        {saved.comment && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ivory/90">“{saved.comment}”</p>}
        <button type="button" onClick={() => setEditing(true)} className="mt-2 text-xs text-gold-soft underline-offset-4 hover:underline">
          Edit my rating
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-line bg-black/30 p-4">
      <p className="font-display text-lg text-gold-soft">{title}</p>
      <div className="mt-2">
        <StarRating value={rating} onChange={setRating} />
      </div>
      <label htmlFor={`fb-${orderId}`} className="sr-only">
        Comment (optional)
      </label>
      <textarea
        id={`fb-${orderId}`}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={MAX_COMMENT}
        rows={3}
        placeholder="Tell us more (optional)"
        className="mt-3 w-full resize-none rounded-xl border border-line bg-ink px-3 py-2 text-sm text-ivory outline-none placeholder:text-muted/60 focus:border-gold"
      />
      <div className="mt-1 text-right text-xs text-muted">
        {comment.length}/{MAX_COMMENT}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-red-300">
          {error}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <button type="submit" disabled={busy} className="btn-gold px-5 py-2 text-sm">
          {busy ? "Saving…" : "Submit feedback"}
        </button>
        {saved && (
          <button type="button" onClick={() => { setEditing(false); setRating(saved.rating); setComment(saved.comment); setError(""); }} className="text-sm text-muted hover:text-ivory">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
