import type { CartViewData } from "./CartPanel";

export function OrderConfirm({ orderId, cart }: { orderId: string; cart: CartViewData }) {
  return (
    <div className="rounded-xl border border-green-300 bg-green-50 p-4">
      <div className="flex items-center gap-2 text-green-800">
        <span aria-hidden>✅</span>
        <h3 className="font-semibold">Order placed</h3>
      </div>
      <p className="mt-1 text-sm text-green-900">
        Order ID: <span className="font-mono font-semibold">{orderId}</span>
      </p>
      <ul className="mt-2 space-y-0.5 text-sm text-stone-700">
        {cart.lines.map((l) => (
          <li key={l.itemId} className="flex justify-between">
            <span>
              {l.qty} × {l.name}
            </span>
            <span>₹{l.lineTotal}</span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex justify-between border-t border-green-200 pt-2 font-semibold text-green-900">
        <span>Total</span>
        <span>₹{cart.total}</span>
      </div>
    </div>
  );
}
