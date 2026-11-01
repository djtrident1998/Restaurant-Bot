import type { CartViewData } from "./CartPanel";

export function OrderConfirm({ orderId, cart }: { orderId: string; cart: CartViewData }) {
  return (
    <div className="rounded-2xl border border-gold/60 bg-gradient-to-b from-[#241c10] to-panel p-5 shadow-[0_0_40px_-12px_rgba(201,162,77,0.5)]">
      <div className="text-center">
        <div className="text-2xl text-gold">✦</div>
        <h3 className="font-display text-xl text-gold-soft">Order placed</h3>
        <p className="mt-1 text-sm text-muted">
          Order ID <span className="font-mono font-semibold text-ivory">{orderId}</span>
        </p>
      </div>
      <div className="ornament my-3 text-xs">◆</div>
      <ul className="space-y-1 text-sm text-ivory">
        {cart.lines.map((l) => (
          <li key={l.itemId} className="flex justify-between">
            <span>
              {l.qty} × {l.name}
            </span>
            <span className="text-muted">₹{l.lineTotal}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-between border-t border-line pt-3 font-display text-lg text-gold-soft">
        <span>Total</span>
        <span>₹{cart.total}</span>
      </div>
    </div>
  );
}
