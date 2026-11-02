"use client";

import Image from "next/image";
import { useState } from "react";
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

const MAX_QTY = 20; // same cap as the cart (MAX_QTY_PER_LINE in lib/tools.ts)

/** Food-app style dish row: details on the left, photo on the right with a quantity stepper and an ADD button. */
export function MenuCard({ item, onAdd, disabled }: { item: MenuCardItem; onAdd: (item: MenuCardItem, qty: number) => void; disabled?: boolean }) {
  const [qty, setQty] = useState(1);
  return (
    <article className="card flex items-stretch gap-3 p-3.5 transition hover:-translate-y-0.5 hover:border-gold/40">
      <div className="flex min-w-0 flex-1 flex-col">
        <DietBadge veg={item.veg} spice={item.spice} />
        <h4 className="mt-1.5 text-[17px] font-bold leading-snug text-ivory">{item.name}</h4>
        <p className="mt-0.5 text-base font-semibold text-ivory">₹{item.price}</p>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{item.description}</p>
        {item.allergens.length > 0 && <p className="mt-1.5 text-xs text-muted/80">Contains: {item.allergens.join(", ")}</p>}
      </div>

      <div className="flex w-[124px] shrink-0 flex-col items-center sm:w-[138px]">
        <div className="relative h-[112px] w-full overflow-hidden rounded-2xl bg-panel2 sm:h-[124px]">
          {item.image && (
            <Image
              unoptimized
              src={photoUrl(item.image, 420, 380)}
              alt={item.name}
              width={420}
              height={380}
              loading="eager" /* cards only appear after the visitor asks for them, so fetch the photos straight away */
              className="h-full w-full object-cover"
            />
          )}
        </div>
        <div className="relative z-10 -mt-4 flex w-[118px] items-center justify-between rounded-xl border border-line bg-panel px-1 py-1 shadow-md">
          <button
            type="button"
            aria-label={`Fewer ${item.name}`}
            disabled={disabled || qty <= 1}
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="h-9 w-9 rounded-lg text-xl font-bold leading-none text-gold-soft hover:bg-gold/10 disabled:text-muted/40"
          >
            −
          </button>
          <span className="min-w-5 text-center text-sm font-bold text-ivory" aria-live="polite">
            {qty}
          </span>
          <button
            type="button"
            aria-label={`More ${item.name}`}
            disabled={disabled || qty >= MAX_QTY}
            onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
            className="h-9 w-9 rounded-lg text-xl font-bold leading-none text-gold-soft hover:bg-gold/10 disabled:text-muted/40"
          >
            +
          </button>
        </div>
        <button type="button" disabled={disabled} onClick={() => onAdd(item, qty)} className="btn-gold mt-2 min-h-10 w-[118px] px-2 py-2 text-sm uppercase tracking-wide">
          Add{qty > 1 ? ` · ₹${item.price * qty}` : ""}
        </button>
      </div>
    </article>
  );
}
