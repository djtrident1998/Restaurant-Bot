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
    <aside aria-label="Your cart" className="flex h-full flex-col rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-semibold text-stone-900">Your cart</h2>
      {cart.lines.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">Nothing here yet. Ask for a dish or tap “Add to cart”.</p>
      ) : (
        <ul className="mt-3 flex-1 divide-y divide-stone-100 overflow-y-auto">
          {cart.lines.map((l) => (
            <li key={l.itemId} className="flex items-start justify-between gap-2 py-2 text-sm">
              <div>
                <div className="font-medium text-stone-900">{l.name}</div>
                <div className="text-stone-500">
                  {l.qty} × ₹{l.unitPrice}
                </div>
              </div>
              <div className="font-medium text-stone-900">₹{l.lineTotal}</div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 border-t border-stone-200 pt-3">
        <div className="flex items-center justify-between font-semibold text-stone-900">
          <span>Total</span>
          <span data-testid="cart-total">₹{cart.total}</span>
        </div>
        <button
          type="button"
          disabled={disabled || cart.lines.length === 0}
          onClick={onCheckout}
          className="mt-3 w-full rounded-lg bg-green-700 px-3 py-2.5 text-sm font-medium text-white transition hover:bg-green-800 disabled:opacity-40"
        >
          Checkout
        </button>
      </div>
    </aside>
  );
}
