import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in — Spice Route" };

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/order");
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to see your past orders and be greeted by name.">
      <AuthForm mode="login" />
    </AuthShell>
  );
}
