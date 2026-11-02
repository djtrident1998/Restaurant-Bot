import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CancelOrder } from "@/components/CancelOrder";
import { FeedbackForm } from "@/components/FeedbackForm";
import { cancelEligibility } from "@/lib/cancel";
import type { OrderRecord } from "@/lib/auth/store";
import { SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/auth/store";

export const metadata: Metadata = { title: "Your account — Spice Route" };

/** Whole minutes left in the cancellation window (0 if over or already cancelled). */
function cancelMinutesLeft(o: OrderRecord): number {
  const e = cancelEligibility(o);
  return e.ok ? Math.max(1, Math.ceil(e.msLeft / 60_000)) : 0;
}

export default async function AccountPage() {
  const current = await getCurrentUser();
  if (!current) redirect("/login");
  const store = getStore();
  const user = await store.findById(current.id);
  const orders = [...(user?.orders ?? [])].sort((a, b) => b.placedAt - a.placedAt);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:px-8">
        <p className="text-xs uppercase tracking-[0.35em] text-gold">Your account</p>
        <h1 className="font-display mt-2 text-4xl text-ivory">{current.name}</h1>
        <p className="mt-1 text-sm text-muted">{current.email}</p>
        <div className="ornament my-8 text-xs">◆</div>

        <h2 className="font-display text-2xl text-gold-soft">Past orders</h2>
        {orders.length === 0 ? (
          <div className="card mt-4 p-6 text-muted">
            You haven&apos;t placed an order yet.{" "}
            <Link href="/order" className="text-gold-soft underline-offset-4 hover:underline">
              Start one now
            </Link>
            .
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {orders.map((o) => (
              <li key={o.id} className="card p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-mono text-sm text-ivory">{o.id}</span>
                  <time className="text-xs text-muted" dateTime={new Date(o.placedAt).toISOString()}>
                    {new Date(o.placedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </time>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-ivory/90">
                  {o.lines.map((l, i) => (
                    <li key={i} className="flex justify-between">
                      <span>
                        {l.qty} × {l.name}
                      </span>
                      <span className="text-muted">₹{l.lineTotal}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex justify-between border-t border-line pt-3 font-display text-lg text-gold-soft">
                  <span>Total</span>
                  <span>₹{o.total}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <a href={`/api/invoice/${o.id}`} download className="btn-ghost inline-block px-4 py-1.5 text-sm">
                    Download invoice (PDF)
                  </a>
                </div>
                {o.cancelledAt ? (
                  <div className="mt-3 rounded-xl border border-gold/40 bg-black/30 p-4 text-sm" data-testid="order-cancelled">
                    <p className="font-display text-gold-soft">Cancelled</p>
                    <p className="mt-1 text-ivory/90">
                      Refund of ₹{o.refund?.amount ?? o.total} recorded{o.refund ? ` (ref ${o.refund.ref})` : ""} on{" "}
                      {new Date(o.cancelledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.
                    </p>
                  </div>
                ) : (
                  <>
                    {cancelMinutesLeft(o) > 0 && (
                      <div className="mt-3">
                        <CancelOrder orderId={o.id} total={o.total} minutesLeft={cancelMinutesLeft(o)} refreshAfter />
                      </div>
                    )}
                    <div className="mt-3">
                      <FeedbackForm
                        orderId={o.id}
                        initial={o.feedback ? { rating: o.feedback.rating, comment: o.feedback.comment } : undefined}
                        title="Rate this order"
                      />
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {store.kind === "memory" && <p className="mt-6 text-xs text-muted">Demo notice: order history is kept in temporary memory and may be reset when the server restarts.</p>}
      </main>
    </div>
  );
}
