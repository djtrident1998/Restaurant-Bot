import type { Metadata } from "next";
import { Chat, type LastOrder } from "@/components/Chat";
import { SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/auth/store";

export const metadata: Metadata = { title: "Order with the AI waiter", description: "Ask for what you fancy by chat or voice, add dishes to your cart and place your order. Every price comes from the real menu." };

export default async function OrderPage() {
  const user = await getCurrentUser();

  // A returning customer is shown their most recent order.
  let lastOrder: LastOrder | undefined;
  if (user) {
    const record = await getStore().findById(user.id);
    const latest = [...(record?.orders ?? [])].sort((a, b) => b.placedAt - a.placedAt)[0];
    if (latest) lastOrder = { id: latest.id, total: latest.total, placedAt: latest.placedAt, items: latest.lines.map((l) => `${l.qty} × ${l.name}`).join(", ") };
  }

  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex min-h-0 flex-1 flex-col outline-none">
        <Chat userName={user?.name.split(" ")[0]} signedIn={!!user} lastOrder={lastOrder} profile={user?.profile} />
      </main>
    </div>
  );
}
