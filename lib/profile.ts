// Allergen Shield: a saved food profile (vegetarian only, allergens to avoid) that is applied by CODE everywhere — dish
// cards, the add-to-cart reply, and the AI's instructions. Browser-safe (no server imports).

export const ALLERGENS = ["nuts", "dairy", "gluten", "fish", "egg"] as const;
export type Allergen = (typeof ALLERGENS)[number];

export interface Profile {
  vegOnly: boolean;
  avoid: Allergen[];
}

export const EMPTY_PROFILE: Profile = { vegOnly: false, avoid: [] };

export const ALLERGEN_LABEL: Record<Allergen, string> = { nuts: "Nuts", dairy: "Dairy", gluten: "Gluten", fish: "Fish", egg: "Egg" };

/** Accepts only a well-formed profile: unknown allergens are dropped, duplicates removed, order fixed. */
export function normalizeProfile(raw: unknown): Profile {
  const r = (raw ?? {}) as { vegOnly?: unknown; avoid?: unknown };
  const avoid = Array.isArray(r.avoid) ? ALLERGENS.filter((a) => (r.avoid as unknown[]).includes(a)) : [];
  return { vegOnly: r.vegOnly === true, avoid };
}

/** Strict version for user input: rejects anything that isn't exactly the expected shape. */
export function parseProfile(raw: unknown): { ok: true; profile: Profile } | { ok: false; error: string } {
  const r = raw as { vegOnly?: unknown; avoid?: unknown } | null;
  if (!r || typeof r !== "object" || typeof r.vegOnly !== "boolean" || !Array.isArray(r.avoid)) return { ok: false, error: "Invalid profile." };
  if (r.avoid.some((a) => !ALLERGENS.includes(a as Allergen))) return { ok: false, error: "Unknown allergen." };
  return { ok: true, profile: normalizeProfile(r) };
}

export const hasProfile = (p: Profile | undefined | null): p is Profile => !!p && (p.vegOnly || p.avoid.length > 0);

export type Fit = { status: "none" } | { status: "ok" } | { status: "avoid"; reasons: string[] };

/** Does this dish fit the profile? Reasons are shown to the customer in plain words. */
export function dishFit(item: { veg: boolean; allergens: string[] }, p: Profile | undefined | null): Fit {
  if (!hasProfile(p)) return { status: "none" };
  const reasons: string[] = [];
  for (const a of p.avoid) if (item.allergens.includes(a)) reasons.push(`contains ${a}`);
  if (p.vegOnly && !item.veg) reasons.push("is not vegetarian");
  return reasons.length ? { status: "avoid", reasons } : { status: "ok" };
}

/** "vegetarian only, no nuts or dairy" */
export function profileSummary(p: Profile): string {
  const parts: string[] = [];
  if (p.vegOnly) parts.push("vegetarian only");
  if (p.avoid.length) parts.push(`avoiding ${p.avoid.join(", ")}`);
  return parts.join(", ");
}

/** The sentence appended to the add-to-cart reply when a dish conflicts with the profile. */
export function addWarning(name: string, fit: Fit): string {
  return fit.status === "avoid" ? `\n\n⚠️ **Heads up:** ${name} ${fit.reasons.join(" and ")}, which is on your Allergen Shield. It's added — remove it if that's a problem, and always check allergies with the restaurant.` : "";
}

/** Extra instruction for the AI when the signed-in customer has a profile. Kept short: every token counts. */
export function promptNote(p: Profile | undefined | null): string {
  if (!hasProfile(p)) return "";
  return `\n\nCUSTOMER FOOD PROFILE (from their account): ${profileSummary(p)}. Never recommend a dish that conflicts with it. If asked about a conflicting dish, say clearly that it conflicts. Always remind them to confirm allergies with staff.`;
}
