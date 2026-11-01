import { DietBadge } from "./DietChip";

export interface MenuCardItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  veg: boolean;
  spice: number;
  allergens: string[];
}

export function MenuCard({ item, onAdd, disabled }: { item: MenuCardItem; onAdd: (item: MenuCardItem) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col justify-between rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-semibold text-stone-900">{item.name}</h4>
          <span className="shrink-0 font-semibold text-amber-800">₹{item.price}</span>
        </div>
        <p className="mt-1 text-sm text-stone-600">{item.description}</p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <DietBadge veg={item.veg} spice={item.spice} />
          {item.allergens.length > 0 && <span className="text-xs text-stone-500">Contains: {item.allergens.join(", ")}</span>}
        </div>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAdd(item)}
        className="mt-3 rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-800 active:scale-95 disabled:opacity-50"
      >
        Add to cart
      </button>
    </div>
  );
}
