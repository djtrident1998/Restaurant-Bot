import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/auth/store";

export const metadata: Metadata = { title: "Create account", description: "Create a free Spice Route account to order food, see your order history and split bills with friends." };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/order");
  // Be upfront when accounts are only held in server memory (no database connected yet).
  const notice = getStore().kind === "memory" ? "Demo notice: accounts are kept in temporary memory and may be reset when the server restarts." : undefined;
  return (
    <AuthShell title="Create your account" subtitle="Join Spice Route to keep a record of your orders.">
      <AuthForm mode="signup" notice={notice} />
    </AuthShell>
  );
}
