export interface CartLineView {
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}
export interface CartViewData {
  lines: CartLineView[];
  itemCount: number;
  total: number;
}

export function CartPanel({
  cart,
  onCheckout,
  onAdjust,
  serviceText,
  disabled,
  signedIn = false,
}: {
  cart: CartViewData;
  /** e.g. "Delivery" or "Dining — table booked Thu, 5 Nov at 7:30 pm (T5)". */
  serviceText?: string;
  onCheckout: () => void;
  /** Change a dish's quantity by one (+1 / -1). Removing the last one takes the dish out of the cart. */
  onAdjust?: (line: CartLineView, delta: 1 | -1) => void;
  disabled?: boolean;
  signedIn?: boolean;
}) {
  return (
    <aside aria-label="Your cart" className="card flex h-full flex-col p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl text-ivory">Your order</h2>
        {cart.itemCount > 0 && (
          <span className="rounded-full bg-gold/10 px-2.5 py-0.5 text-xs font-bold text-gold-soft">
            {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}
          </span>
        )}
      </div>
      {cart.lines.length === 0 ? (
        <div className="mt-6 flex flex-1 flex-col items-center justify-center py-6 text-center">
          <div className="text-4xl" aria-hidden>
            🛒
          </div>
          <p className="mt-2 text-sm text-muted">Your cart is empty. Pick a category, or tap ADD on a dish you like.</p>
        </div>
      ) : (
        <ul className="mt-3 flex-1 divide-y divide-line overflow-y-auto">
          {cart.lines.map((l) => (
            <li key={l.itemId} className="flex items-center justify-between gap-2 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="font-semibold text-ivory">{l.name}</div>
                <div className="text-muted">₹{l.unitPrice} each</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {onAdjust ? (
                  <div className="flex items-center rounded-lg border border-line" role="group" aria-label={`Quantity of ${l.name}`}>
                    <button type="button" disabled={disabled} onClick={() => onAdjust(l, -1)} aria-label={l.qty === 1 ? `Remove ${l.name}` : `One fewer ${l.name}`} className="h-9 w-9 text-lg font-bold text-gold-soft hover:bg-gold/10 disabled:opacity-40">
                      {l.qty === 1 ? "🗑" : "−"}
                    </button>
                    <span className="min-w-6 text-center font-bold text-ivory" aria-live="polite">
                      {l.qty}
                    </span>
                    <button type="button" disabled={disabled || l.qty >= 20} onClick={() => onAdjust(l, 1)} aria-label={`One more ${l.name}`} className="h-9 w-9 text-lg font-bold text-gold-soft hover:bg-gold/10 disabled:opacity-40">
                      +
                    </button>
                  </div>
                ) : (
                  <span className="text-muted">× {l.qty}</span>
                )}
                <span className="w-14 text-right font-semibold text-ivory">₹{l.lineTotal}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 border-t border-line pt-3">
        {serviceText && (
          <p className="mb-2 rounded-lg bg-panel2 px-3 py-1.5 text-xs font-semibold text-ivory" data-testid="cart-service">
            {serviceText}
          </p>
        )}
        <div className="flex items-center justify-between text-lg font-bold text-ivory">
          <span>To pay</span>
          <span data-testid="cart-total">₹{cart.total}</span>
        </div>
        <button type="button" disabled={disabled || cart.lines.length === 0} onClick={onCheckout} className="btn-gold mt-3 w-full px-3 py-3 text-base">
          {signedIn ? "Checkout" : "Sign in to checkout"}
        </button>
      </div>
    </aside>
  );
}
