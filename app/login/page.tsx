import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { AuthShell } from "@/components/AuthShell";
import { safeNext } from "@/lib/auth/next";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ deleted?: string; next?: string }> }) {
  const { deleted, next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  if (await getCurrentUser()) redirect(next ?? "/order");
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to see your past orders and be greeted by name.">
      {deleted === "1" && (
        <p role="status" className="mb-4 rounded-xl border border-green-400/40 bg-green-950/40 px-4 py-3 text-sm text-green-200">
          Your account has been deleted: your details, orders and ratings are gone. Thank you for trying Spice Route.
        </p>
      )}
      <AuthForm mode="login" next={next} />
    </AuthShell>
  );
}
