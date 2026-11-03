import type { Metadata } from "next";
import { Chat, type LastOrder } from "@/components/Chat";
import { SiteHeader } from "@/components/SiteHeader";
import { isUpcoming } from "@/lib/booking";
import { getCurrentAccount } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Order with the AI waiter", description: "Ask for what you fancy by chat or voice, add dishes to your cart and place your order. Every price comes from the real menu." };

export default async function OrderPage({ searchParams }: { searchParams: Promise<{ mode?: string; booking?: string }> }) {
  // One account read for the whole page (the header reuses it). If storage is briefly unavailable the page still
  // opens, just without the personal bits, instead of showing an error screen.
  const account = await getCurrentAccount();
  const user = account?.user;
  const { mode, booking } = await searchParams;

  // A returning customer is shown their most recent order.
  const latest = [...(account?.orders ?? [])].sort((a, b) => b.placedAt - a.placedAt)[0];
  const lastOrder: LastOrder | undefined = latest
    ? { id: latest.id, total: latest.total, placedAt: latest.placedAt, items: latest.lines.map((l) => `${l.qty} × ${l.name}`).join(", ") }
    : undefined;

  // Upcoming table bookings, so a dining order can be tied to one.
  const bookings = (account?.bookings ?? []).filter((b) => isUpcoming(b)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
        <Chat
          userName={user?.name.split(" ")[0]}
          signedIn={!!user}
          lastOrder={lastOrder}
          profile={user?.profile}
          bookings={bookings}
          initialMode={mode === "dining" ? "dine-in" : mode === "delivery" ? "delivery" : undefined}
          initialBookingId={mode === "dining" ? bookings.find((b) => b.id === (booking ?? "").toUpperCase())?.id : undefined}
        />
      </main>
    </div>
  );
}
