import type { CartViewData } from "./CartPanel";
import { CancelOrder } from "./CancelOrder";
import { serviceShort, type Service } from "@/lib/service";
import { FeedbackForm } from "./FeedbackForm";
import { SplitBill } from "./SplitBill";

export function OrderConfirm({ orderId, cart, service }: { orderId: string; cart: CartViewData; service?: Service }) {
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[var(--veg)]/30 bg-gradient-to-b from-[#effaf2] to-panel p-5 shadow-[0_12px_30px_-18px_rgba(26,156,75,0.5)]">
        <div className="text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--veg)] text-xl text-white" aria-hidden>
            ✓
          </div>
          <h3 className="font-display mt-2 text-xl text-ivory">Order placed</h3>
          <p className="mt-1 text-sm text-muted">
            Order ID <span className="font-mono font-semibold text-ivory">{orderId}</span>
          </p>
          {service && (
            <p className="mt-2 inline-block rounded-full bg-panel2 px-3 py-1 text-xs font-bold text-ivory" data-testid="order-service">
              {service.type === "delivery" ? "🛵" : "🍽"} {serviceShort(service)}
            </p>
          )}
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
        <div className="mt-3 flex justify-between border-t border-line pt-3 font-display text-lg text-ivory">
          <span>Total</span>
          <span>₹{cart.total}</span>
        </div>
        <div className="mt-4 text-center">
          <a href={`/api/invoice/${orderId}`} download className="btn-ghost inline-block px-5 py-2 text-sm">
            Download invoice (PDF)
          </a>
        </div>
      </div>
      <SplitBill orderId={orderId} total={cart.total} lines={cart.lines.map((l) => ({ name: l.name, qty: l.qty, lineTotal: l.lineTotal }))} />
      <CancelOrder orderId={orderId} total={cart.total} />
      <FeedbackForm orderId={orderId} />
    </div>
  );
}
