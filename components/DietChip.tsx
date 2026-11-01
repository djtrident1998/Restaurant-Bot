export function DietBadge({ veg, spice }: { veg: boolean; spice: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-stone-600">
      <span
        title={veg ? "Vegetarian" : "Non-vegetarian"}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-[3px] border-2 ${veg ? "border-green-600" : "border-red-600"}`}
      >
        <span className={`h-2 w-2 rounded-full ${veg ? "bg-green-600" : "bg-red-600"}`} />
      </span>
      <span aria-label={`Spice level ${spice} of 3`} title={`Spice ${spice}/3`}>
        {spice === 0 ? "Mild" : "🌶".repeat(spice)}
      </span>
    </span>
  );
}

export function DietChip({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="shrink-0 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-900 transition hover:bg-amber-100 active:scale-95 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
