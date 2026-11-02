"use client";

import { useMemo, useState } from "react";
import { MAX_NAME, MAX_PEOPLE, MIN_PEOPLE, computeSplit, type SplitLine } from "@/lib/split";

export interface SavedSplit {
  mode: "equal" | "items";
  people: { name: string; amount: number; paid: boolean }[];
  assign?: number[][];
}

/**
 * Group order: divide an order's bill between people — equally, or dish by dish — and keep track of who has paid.
 * The preview here uses the same maths as the server, but the server recomputes every amount from the saved order.
 * (No online payment exists in this demo: "paid" is a note the host keeps.)
 */
export function SplitBill({ orderId, lines, total, initial }: { orderId: string; lines: SplitLine[]; total: number; initial?: SavedSplit }) {
  const [saved, setSaved] = useState<SavedSplit | undefined>(initial);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"equal" | "items">(initial?.mode ?? "equal");
  const [names, setNames] = useState<string[]>(initial?.people.map((p) => p.name) ?? ["Me", "Guest 2"]);
  const [assign, setAssign] = useState<number[][]>(initial?.assign ?? lines.map(() => []));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const preview = useMemo(() => computeSplit(lines, mode === "equal" ? { mode, people: names } : { mode, people: names, assign }), [lines, mode, names, assign]);

  async function call(body: unknown): Promise<{ split?: SavedSplit } | null> {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/orders/split", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) {
        setError(j.error || "Sorry, that didn't work. Please try again.");
        return null;
      }
      return j;
    } catch {
      setError("Network problem. Please try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const j = await call({ orderId, action: "save", spec: mode === "equal" ? { mode, people: names } : { mode, people: names, assign } });
    if (j?.split) {
      setSaved(j.split);
      setEditing(false);
    }
  }

  async function togglePaid(index: number, paid: boolean) {
    const j = await call({ orderId, action: "paid", index, paid });
    if (j?.split) setSaved(j.split);
  }

  async function copy() {
    if (!saved) return;
    const text = `Spice Route order ${orderId} — ₹${total} split:\n` + saved.people.map((p) => `${p.name}: ₹${p.amount}${p.paid ? " (paid)" : ""}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. You can select the amounts above instead.");
    }
  }

  const togglePerson = (line: number, person: number) =>
    setAssign((a) => a.map((row, i) => (i !== line ? row : row.includes(person) ? row.filter((p) => p !== person) : [...row, person])));
  const removePerson = (i: number) => {
    setNames((n) => n.filter((_, k) => k !== i));
    setAssign((a) => a.map((row) => row.filter((p) => p !== i).map((p) => (p > i ? p - 1 : p))));
  };

  // ---- saved view ----
  if (saved && !editing) {
    const anyPaid = saved.people.some((p) => p.paid);
    const paidTotal = saved.people.filter((p) => p.paid).reduce((n, p) => n + p.amount, 0);
    return (
      <div className="rounded-xl border border-line bg-panel2 p-4" data-testid="split-saved">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-lg text-gold-soft">Bill split · {saved.people.length} people</p>
          <span className="text-xs text-muted">
            ₹{paidTotal} of ₹{total} collected
          </span>
        </div>
        <ul className="mt-2 divide-y divide-line">
          {saved.people.map((p, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="min-w-0 truncate text-ivory">{p.name}</span>
              <span className="flex items-center gap-3">
                <span className="font-medium text-ivory">₹{p.amount}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => togglePaid(i, !p.paid)}
                  aria-pressed={p.paid}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${p.paid ? "bg-[var(--veg)] text-white" : "border border-line text-muted hover:border-gold hover:text-ivory"}`}
                >
                  {p.paid ? "Paid ✓" : "Mark paid"}
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" onClick={copy} className="btn-ghost px-4 py-1.5 text-sm">
            {copied ? "Copied ✓" : "Copy summary"}
          </button>
          {!anyPaid && (
            <button type="button" onClick={() => setEditing(true)} className="text-sm text-gold-soft underline-offset-4 hover:underline">
              Change split
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">Demo note: no online payment is taken, so “Paid” is just a note for the host.</p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (!open && !editing) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn-ghost w-full px-4 py-2 text-sm">
        Group order? Split the bill
      </button>
    );
  }

  // ---- editor ----
  return (
    <div className="rounded-xl border border-line bg-panel2 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-lg text-gold-soft">Split the bill · ₹{total}</p>
        <div className="inline-flex overflow-hidden rounded-full border border-line text-xs font-semibold" role="group" aria-label="Split mode">
          {(["equal", "items"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} aria-pressed={mode === m} className={`px-3 py-1.5 ${mode === m ? "bg-gold text-white" : "text-muted"}`}>
              {m === "equal" ? "Equally" : "By dish"}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-xs uppercase tracking-wider text-muted">Who&apos;s paying?</p>
      <ul className="mt-1 space-y-2">
        {names.map((n, i) => (
          <li key={i} className="flex gap-2">
            <label className="sr-only" htmlFor={`${orderId}-p${i}`}>
              Person {i + 1}
            </label>
            <input
              id={`${orderId}-p${i}`}
              value={n}
              maxLength={MAX_NAME}
              onChange={(e) => setNames((arr) => arr.map((x, k) => (k === i ? e.target.value : x)))}
              className="min-w-0 flex-1 rounded-lg border border-line bg-ink px-3 py-1.5 text-sm text-ivory outline-none focus:border-gold"
            />
            {names.length > MIN_PEOPLE && (
              <button type="button" onClick={() => removePerson(i)} aria-label={`Remove ${n || `person ${i + 1}`}`} className="rounded-lg px-2 text-muted hover:text-ivory">
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
      {names.length < MAX_PEOPLE && (
        <button type="button" onClick={() => setNames((n) => [...n, `Guest ${n.length + 1}`])} className="mt-2 text-sm text-gold-soft underline-offset-4 hover:underline">
          + Add a person
        </button>
      )}

      {mode === "items" && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider text-muted">Who shares each dish? (none ticked = everyone)</p>
          <ul className="mt-1 divide-y divide-line">
            {lines.map((l, li) => (
              <li key={li} className="py-2">
                <div className="flex justify-between text-sm text-ivory">
                  <span>
                    {l.qty} × {l.name}
                  </span>
                  <span className="text-muted">₹{l.lineTotal}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {names.map((n, pi) => {
                    const on = assign[li]?.includes(pi);
                    return (
                      <button key={pi} type="button" aria-pressed={on} onClick={() => togglePerson(li, pi)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${on ? "bg-gold text-white" : "border border-line text-muted"}`}>
                        {n.trim() || `Person ${pi + 1}`}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 rounded-lg bg-ink p-3" aria-live="polite">
        {preview.ok ? (
          <ul className="space-y-1 text-sm">
            {preview.shares.map((s, i) => (
              <li key={i} className="flex justify-between">
                <span className="text-ivory">{s.name}</span>
                <span className="font-medium text-gold-soft">₹{s.amount}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{preview.error}</p>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button type="button" disabled={busy || !preview.ok} onClick={save} className="btn-gold px-5 py-2 text-sm">
          {busy ? "Saving…" : "Save split"}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setEditing(false);
            setError("");
          }}
          className="text-sm text-muted hover:text-ivory"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
