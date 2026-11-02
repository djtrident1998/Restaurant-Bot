"use client";

import { useState } from "react";
import { ALLERGENS, ALLERGEN_LABEL, hasProfile, profileSummary, type Allergen, type Profile } from "@/lib/profile";

/** Allergen Shield settings: tell us once, and every dish card, add-to-cart reply and AI answer takes it into account. */
export function ProfileCard({ initial }: { initial: Profile }) {
  const [saved, setSaved] = useState<Profile>(initial);
  const [vegOnly, setVegOnly] = useState(initial.vegOnly);
  const [avoid, setAvoid] = useState<Allergen[]>(initial.avoid);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = vegOnly !== saved.vegOnly || avoid.join() !== saved.avoid.join();
  const toggle = (a: Allergen) => setAvoid((cur) => ALLERGENS.filter((x) => (x === a ? !cur.includes(a) : cur.includes(x))));

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ vegOnly, avoid }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) setMessage({ ok: false, text: j.error || "Sorry, we couldn't save that. Please try again." });
      else {
        setSaved(j.profile);
        setMessage({ ok: true, text: hasProfile(j.profile) ? `Saved. Dishes are now checked against: ${profileSummary(j.profile)}.` : "Saved. Allergen Shield is off." });
      }
    } catch {
      setMessage({ ok: false, text: "Network problem. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="profile" className="card mt-8 scroll-mt-24 p-5" aria-labelledby="profile-heading">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>
          🛡
        </span>
        <div>
          <h2 id="profile-heading" className="font-display text-xl text-ivory">
            Allergen Shield
          </h2>
          <p className="mt-0.5 text-sm text-muted">Tell us once. Every dish is flagged for you, adding a conflicting dish gets a warning, and the AI waiter is told what to avoid.</p>
        </div>
      </div>

      <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-ivory">
        <input type="checkbox" checked={vegOnly} onChange={(e) => setVegOnly(e.target.checked)} className="h-5 w-5 accent-[var(--gold)]" />
        I eat vegetarian only
      </label>

      <fieldset className="mt-3">
        <legend className="text-xs font-bold uppercase tracking-[0.18em] text-muted">I need to avoid</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {ALLERGENS.map((a) => {
            const on = avoid.includes(a);
            return (
              <label key={a} className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold ${on ? "border-red-300 bg-red-50 text-red-800" : "border-line text-ivory"}`}>
                <input type="checkbox" checked={on} onChange={() => toggle(a)} className="h-4 w-4 accent-[var(--gold)]" />
                {ALLERGEN_LABEL[a]}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy || !dirty} onClick={save} className="btn-gold px-5 py-2.5 text-sm">
          {busy ? "Saving…" : "Save my profile"}
        </button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-sm font-semibold ${message.ok ? "text-green-800" : "text-red-700"}`}>
            {message.text}
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">Allergen data on the menu is indicative. Always confirm serious allergies with the restaurant — we can&apos;t guarantee a dish is free of cross-contact.</p>
    </section>
  );
}
