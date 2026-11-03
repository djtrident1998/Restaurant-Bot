import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BookingsList } from "@/components/BookingsList";
import { CancelOrder } from "@/components/CancelOrder";
import { serviceShort } from "@/lib/service";
import { Credit } from "@/components/Credit";
import { DataControls } from "@/components/DataControls";
import { ProfileCard } from "@/components/ProfileCard";
import { FeedbackForm } from "@/components/FeedbackForm";
import { SplitBill } from "@/components/SplitBill";
import { cancelEligibility } from "@/lib/cancel";
import type { OrderRecord } from "@/lib/auth/store";
import { SiteHeader } from "@/components/SiteHeader";
import { getCurrentAccount } from "@/lib/auth/session";
import { getStore } from "@/lib/auth/store";

export const metadata: Metadata = { title: "Your account", robots: { index: false, follow: false } };

/** Whole minutes left in the cancellation window (0 if over or already cancelled). */
function cancelMinutesLeft(o: OrderRecord): number {
  const e = cancelEligibility(o);
  return e.ok ? Math.max(1, Math.ceil(e.msLeft / 60_000)) : 0;
}

export default async function AccountPage() {
  const account = await getCurrentAccount(); // one storage read, shared with the header
  if (!account) redirect("/login");
  const current = account.user;
  const store = getStore();
  const orders = [...account.orders].sort((a, b) => b.placedAt - a.placedAt);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 outline-none sm:px-8">
        <div className="card flex items-center gap-4 p-5">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--gold-deep)] text-2xl font-bold text-white" aria-hidden>
            {current.name.trim().charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="font-display truncate text-2xl text-ivory">{current.name}</h1>
            <p className="truncate text-sm text-muted">{current.email}</p>
          </div>
        </div>

        <ProfileCard initial={current.profile} />

        <section id="bookings" className="mt-10 scroll-mt-24" aria-labelledby="bookings-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="bookings-heading" className="font-display text-2xl text-ivory">
              Your table bookings
            </h2>
            <Link href="/book" className="btn-ghost px-4 py-2 text-sm font-semibold">
              Book a table
            </Link>
          </div>
          <BookingsList bookings={account.bookings} />
        </section>

        <h2 className="font-display mt-10 text-2xl text-ivory">Past orders</h2>
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
                  <span className="text-sm">
                    <span className="font-mono text-ivory">{o.id}</span>
                    <span className="ml-2 rounded-full bg-panel2 px-2 py-0.5 text-xs font-semibold text-muted">{serviceShort(o.service ?? { type: "delivery" })}</span>
                  </span>
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
                <div className="mt-3 flex justify-between border-t border-line pt-3 font-display text-lg text-ivory">
                  <span>Total</span>
                  <span>₹{o.total}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <a href={`/api/invoice/${o.id}`} download className="btn-ghost inline-block px-4 py-1.5 text-sm">
                    Download invoice (PDF)
                  </a>
                </div>
                {o.cancelledAt ? (
                  <div className="mt-3 rounded-xl border border-gold/30 bg-[#fff1ee] p-4 text-sm" data-testid="order-cancelled">
                    <p className="font-display text-gold-soft">Cancelled</p>
                    <p className="mt-1 text-ivory/90">
                      Refund of ₹{o.refund?.amount ?? o.total} recorded{o.refund ? ` (ref ${o.refund.ref})` : ""} on{" "}
                      {new Date(o.cancelledAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="mt-3">
                      <SplitBill orderId={o.id} total={o.total} lines={o.lines} initial={o.split} />
                    </div>
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
        <DataControls />
        <Credit className="mt-10 text-center" />
        {store.kind === "memory" &&<p className="mt-6 text-xs text-muted">Demo notice: order history is kept in temporary memory and may be reset when the server restarts.</p>}
      </main>
    </div>
  );
}
