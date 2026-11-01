import Image from "next/image";
import { photoUrl } from "@/lib/images";
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
  image?: string;
}

export function MenuCard({ item, onAdd, disabled }: { item: MenuCardItem; onAdd: (item: MenuCardItem) => void; disabled?: boolean }) {
  return (
    <article className="card group flex flex-col overflow-hidden transition hover:border-gold/60">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-panel2">
        {item.image && (
          <Image
            unoptimized
            src={photoUrl(item.image, 640, 400)}
            alt={item.name}
            width={640}
            height={400}
            loading="eager" /* cards only appear after the visitor asks for them, so fetch the photos straight away */
            className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-3 py-1 font-display text-base text-gold-soft ring-1 ring-gold/40 backdrop-blur">
          ₹{item.price}
        </span>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3 p-3.5">
        <div>
          <h4 className="font-display text-lg leading-snug text-ivory">{item.name}</h4>
          <p className="mt-1 line-clamp-2 text-sm text-muted">{item.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <DietBadge veg={item.veg} spice={item.spice} />
            {item.allergens.length > 0 && <span className="text-xs text-muted/80">Contains: {item.allergens.join(", ")}</span>}
          </div>
        </div>
        <button type="button" disabled={disabled} onClick={() => onAdd(item)} className="btn-gold w-full px-3 py-2 text-sm">
          Add to cart
        </button>
      </div>
    </article>
  );
}
