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

export function CartPanel({ cart, onCheckout, disabled }: { cart: CartViewData; onCheckout: () => void; disabled?: boolean }) {
  return (
    <aside aria-label="Your cart" className="card flex h-full flex-col p-4">
      <h2 className="font-display text-xl text-gold-soft">Your order</h2>
      <div className="ornament mt-2 text-xs">◆</div>
      {cart.lines.length === 0 ? (
        <p className="mt-4 text-sm text-muted">Nothing here yet. Choose a course, or tap “Add to cart” on a dish you like.</p>
      ) : (
        <ul className="mt-3 flex-1 divide-y divide-line overflow-y-auto">
          {cart.lines.map((l) => (
            <li key={l.itemId} className="flex items-start justify-between gap-2 py-2.5 text-sm">
              <div>
                <div className="font-medium text-ivory">{l.name}</div>
                <div className="text-muted">
                  {l.qty} × ₹{l.unitPrice}
                </div>
              </div>
              <div className="font-medium text-gold-soft">₹{l.lineTotal}</div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 border-t border-line pt-3">
        <div className="flex items-center justify-between font-display text-lg text-ivory">
          <span>Total</span>
          <span data-testid="cart-total" className="text-gold-soft">
            ₹{cart.total}
          </span>
        </div>
        <button
          type="button"
          disabled={disabled || cart.lines.length === 0}
          onClick={onCheckout}
          className="btn-gold mt-3 w-full px-3 py-2.5 text-sm"
        >
          Checkout
        </button>
      </div>
    </aside>
  );
}
