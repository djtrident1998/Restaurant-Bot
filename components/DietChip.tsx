export function DietBadge({ veg, spice }: { veg: boolean; spice: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span
        title={veg ? "Vegetarian" : "Non-vegetarian"}
        className={`inline-flex h-4 w-4 items-center justify-center rounded-[3px] border-2 ${veg ? "border-[var(--veg)]" : "border-[var(--nonveg)]"}`}
      >
        <span className={`h-2 w-2 rounded-full ${veg ? "bg-[var(--veg)]" : "bg-[var(--nonveg)]"}`} />
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
      className="btn-ghost shrink-0 px-3.5 py-1.5 text-sm font-medium disabled:opacity-40"
    >
      {label}
    </button>
  );
}
