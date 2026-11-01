import raw from "./menu.json";

export const CATEGORIES = [
  "Starters",
  "Veg Mains",
  "Non-Veg Mains",
  "Breads",
  "Rice & Biryani",
  "Desserts",
  "Beverages",
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  category: Category;
  price: number;
  veg: boolean;
  spice: number;
  allergens: string[];
}

export interface MenuFilters {
  veg?: boolean;
  vegan?: boolean;
  maxPrice?: number;
  category?: Category;
  maxSpice?: number;
  excludeAllergen?: string;
}

export const MENU: MenuItem[] = raw as MenuItem[];

export function getItem(id: string): MenuItem | undefined {
  return MENU.find((i) => i.id === id);
}

// Vegan = vegetarian with no dairy or egg.
export function isVegan(item: MenuItem): boolean {
  return item.veg && !item.allergens.includes("dairy") && !item.allergens.includes("egg");
}

const STOP = new Set(["a", "an", "the", "and", "or", "with", "in", "of", "for", "to", "do", "you", "have", "any", "some", "is", "are", "i", "me", "my", "want", "like", "please", "dish", "dishes", "item", "items"]);

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !STOP.has(t));
}

export function searchMenu(query = "", filters: MenuFilters = {}): MenuItem[] {
  const q = tokens(query);
  const exclude = filters.excludeAllergen?.toLowerCase();
  const scored = MENU.filter((i) => {
    if (filters.veg !== undefined && i.veg !== filters.veg) return false;
    if (filters.vegan && !isVegan(i)) return false;
    if (filters.maxPrice !== undefined && i.price > filters.maxPrice) return false;
    if (filters.category && i.category !== filters.category) return false;
    if (filters.maxSpice !== undefined && i.spice > filters.maxSpice) return false;
    if (exclude && i.allergens.includes(exclude)) return false;
    return true;
  }).map((i) => {
    if (q.length === 0) return { i, score: 1 };
    const name = tokens(i.name);
    const hay = tokens(`${i.name} ${i.description} ${i.category}`);
    let score = 0;
    for (const t of q) {
      if (name.includes(t)) score += 3;
      else if (hay.includes(t)) score += 1;
    }
    return { i, score };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).map((s) => s.i);
}
