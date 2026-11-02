// Split-bill maths. Money is computed here, in code, never by the AI and never trusted from the browser: the browser
// only says WHO shares WHAT; amounts always come from the order stored on the customer's account.

export const MIN_PEOPLE = 2;
export const MAX_PEOPLE = 12;
export const MAX_NAME = 30;

export interface SplitLine {
  name: string;
  qty: number;
  lineTotal: number;
}

/** "equal": everyone pays the same. "items": each dish is shared by the people ticked for it (nobody ticked = everyone). */
export type SplitSpec = { mode: "equal"; people: string[] } | { mode: "items"; people: string[]; assign: number[][] };

export interface Share {
  name: string;
  amount: number;
}

export type SplitResult = { ok: true; shares: Share[] } | { ok: false; error: string };

/** Divide whole rupees among `n` people so the parts add up EXACTLY: the first (amount % n) people pay ₹1 more. */
export function divide(amount: number, n: number): number[] {
  const base = Math.floor(amount / n);
  const extra = amount - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

const clean = (s: unknown) => (typeof s === "string" ? s.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim() : "");

export function computeSplit(lines: SplitLine[], spec: unknown): SplitResult {
  const s = spec as Partial<SplitSpec> | null;
  if (!s || (s.mode !== "equal" && s.mode !== "items") || !Array.isArray(s.people)) return { ok: false, error: "Please choose how to split the bill." };

  const names = s.people.map(clean);
  if (names.length < MIN_PEOPLE || names.length > MAX_PEOPLE) return { ok: false, error: `Split between ${MIN_PEOPLE} and ${MAX_PEOPLE} people.` };
  if (names.some((n) => !n || n.length > MAX_NAME)) return { ok: false, error: `Every person needs a name (up to ${MAX_NAME} characters).` };
  if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return { ok: false, error: "Each person needs a different name." };

  const total = lines.reduce((n, l) => n + l.lineTotal, 0);
  if (!lines.length || total <= 0) return { ok: false, error: "This order has nothing to split." };

  const amounts = new Array<number>(names.length).fill(0);

  if (s.mode === "equal") {
    divide(total, names.length).forEach((a, i) => (amounts[i] = a));
  } else {
    const assign = (s as { assign?: unknown }).assign;
    if (!Array.isArray(assign) || assign.length !== lines.length) return { ok: false, error: "Please say who shares each dish." };
    // Rotate the "extra rupee" so the same person isn't always the one who pays it.
    let rot = 0;
    for (let li = 0; li < lines.length; li++) {
      const raw = assign[li];
      if (!Array.isArray(raw)) return { ok: false, error: "Please say who shares each dish." };
      const idx = raw.length === 0 ? names.map((_, i) => i) : raw;
      if (idx.some((i) => !Number.isInteger(i) || i < 0 || i >= names.length) || new Set(idx).size !== idx.length) return { ok: false, error: "Invalid person chosen for a dish." };
      const sorted = [...idx].sort((a, b) => a - b);
      const parts = divide(lines[li].lineTotal, sorted.length);
      sorted.forEach((p, k) => (amounts[p] += parts[(k + rot) % sorted.length]));
      rot++;
    }
  }

  // Safety net: the shares must add up to the order total to the rupee.
  if (amounts.reduce((a, b) => a + b, 0) !== total) return { ok: false, error: "Could not split this order." };
  return { ok: true, shares: names.map((name, i) => ({ name, amount: amounts[i] })) };
}
