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
  disabled,
  signedIn = false,
}: {
  cart: CartViewData;
  onCheckout: () => void;
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
            <li key={l.itemId} className="flex items-start justify-between gap-2 py-2.5 text-sm">
              <div className="min-w-0">
                <div className="font-semibold text-ivory">{l.name}</div>
                <div className="text-muted">
                  {l.qty} × ₹{l.unitPrice}
                </div>
              </div>
              <div className="font-semibold text-ivory">₹{l.lineTotal}</div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 border-t border-line pt-3">
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
