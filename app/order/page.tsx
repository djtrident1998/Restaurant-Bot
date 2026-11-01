import type { Metadata } from "next";
import { Chat } from "@/components/Chat";
import { SiteHeader } from "@/components/SiteHeader";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Order — Spice Route" };

export default async function OrderPage() {
  const user = await getCurrentUser();
  return (
    <div className="flex h-dvh flex-col">
      <SiteHeader />
      <Chat userName={user?.name.split(" ")[0]} />
    </div>
  );
}
