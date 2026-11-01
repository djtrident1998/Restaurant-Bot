import { MENU } from "./menu";

// ---- 1. Scope: deterministic pre-filter for obvious prompt-injection / jailbreak attempts ----

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all |any |your |the )?(previous|prior|above|earlier) (instructions|rules|prompts?)/i,
  /(reveal|show|print|repeat|tell me) (me )?(your|the) (system )?(prompt|instructions)/i,
  /\byou are now\b/i,
  /\b(jailbreak|DAN mode|developer mode)\b/i,
  /disregard (your|the|all) (rules|instructions|guidelines)/i,
  /pretend (you are|to be) (?!a waiter)/i,
];

export const SCOPE_DECLINE =
  "I can only help with the Spice Route menu, your cart and your order. Want me to suggest something tasty?";

export const MAX_INPUT_CHARS = 1000;

export function checkUserInput(text: string): { ok: true } | { ok: false; reason: string; reply: string } {
  if (text.length > MAX_INPUT_CHARS)
    return { ok: false, reason: "too_long", reply: "That message is a bit long for me — could you shorten it?" };
  if (INJECTION_PATTERNS.some((p) => p.test(text)))
    return { ok: false, reason: "injection", reply: SCOPE_DECLINE };
  return { ok: true };
}

// ---- 2. Grounding: post-reply check that prices and dish names come from menu.json / tool results ----

export interface GroundingResult {
  ok: boolean;
  badPrices: number[];
  badDishes: string[];
}

const menuNames = new Set(MENU.map((i) => i.name.toLowerCase()));
const categoryNames = new Set(MENU.map((i) => i.category.toLowerCase()));
const menuPrices =new Set(MENU.map((i) => i.price));

export function extractRupeeAmounts(text: string): number[] {
  const out: number[] = [];
  const re = /(?:₹|rs\.?\s?|inr\s?)\s?(\d[\d,]*(?:\.\d+)?)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) out.push(Number(m[1].replace(/,/g, "")));
  return out;
}

// Dish names are emphasised (**bold**) in replies; any bold phrase that isn't a menu item (or a
// substring/superstring of one, e.g. "Naan") is flagged.
export function extractBoldPhrases(text: string): string[] {
  return [...text.matchAll(/\*\*([^*]{2,60})\*\*/g)].map((m) => m[1].trim());
}

// Labels the UI/replies legitimately bold that are not dish names.
const LABELS = new Set([
  "total", "grand total", "subtotal", "order", "order id", "order placed", "note", "veg", "vegan", "non-veg",
  "spice", "price", "status", "items", "item", "received", "preparing", "out for delivery", "delivered",
  "main", "mains", "sides", "rice", "drinks", "drink", "breads", "bread", "dessert", "desserts", "starter",
  "starters", "beverages", "biryani", "biryanis", "cart", "your cart", "allergens", "contains",
]);

function isTitleCase(p: string): boolean {
  const words = p.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  return words.length > 0 && words.every((w) => /^[A-Z]/.test(w));
}

function isKnownDishPhrase(p: string): boolean {
  const l = p.toLowerCase().replace(/[.:,]+$/, "").trim();
  if (menuNames.has(l) || categoryNames.has(l) || LABELS.has(l)) return true;
  if (/₹/.test(l) || /^[\d\s×x.,]+$/.test(l) || /^sr-\d+$/i.test(l)) return true; // amounts, quantities, order ids
  // Bold used for emphasis ("dairy and nuts") is not a dish name; dish names are Title Case.
  if (!isTitleCase(p.replace(/[.:,]+$/, ""))) return true;
  for (const n of menuNames) if (n.includes(l) || l.includes(n)) return true;
  return false;
}

/**
 * @param allowedAmounts every number the system produced this conversation (menu prices, line totals,
 *   cart totals). Any ₹ amount in the reply outside this set is an invention.
 */
export function checkGrounding(reply: string, allowedAmounts: Iterable<number> = []): GroundingResult {
  const allowed = new Set<number>([...menuPrices, ...allowedAmounts]);
  const badPrices = extractRupeeAmounts(reply).filter((a) => !allowed.has(a));
  const badDishes = extractBoldPhrases(reply).filter((p) => !isKnownDishPhrase(p));
  return { ok: badPrices.length === 0 && badDishes.length === 0, badPrices, badDishes };
}

/** Collect every amount the system returned in tool results (totals, line totals, prices). */
export function collectToolAmounts(toolResults: unknown[]): Set<number> {
  const nums = new Set<number>();
  const walk = (v: unknown, key = ""): void => {
    if (typeof v === "number" && /price|total|Total|unitPrice/.test(key)) nums.add(v);
    else if (Array.isArray(v)) v.forEach((x) => walk(x, key));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, k);
  };
  toolResults.forEach((r) => walk(r));
  return nums;
}

export const GROUNDING_FALLBACK =
  "Sorry — I want to be sure I give you accurate menu details. Could you ask that again, or tell me which dish you'd like?";
