import Link from "next/link";

/** Shown to guests who try to check out: ordering needs an account, and the cart is kept while they sign in. */
export function AuthPrompt({ compact = false }: { compact?: boolean }) {
  return (
    <div className="rounded-2xl border border-gold/50 bg-gradient-to-b from-[#241c10] to-panel p-4 sm:p-5">
      <p className="font-display text-lg text-gold-soft">Sign in to place your order</p>
      <p className="mt-1 text-sm text-muted">
        {compact ? "Your cart will be kept." : "You can browse and fill your cart as a guest. To order, please sign in — or create an account in a moment. Your cart will be kept."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/login" className="btn-gold px-5 py-2 text-sm">
          Sign in
        </Link>
        <Link href="/signup" className="btn-ghost px-5 py-2 text-sm">
          Create account
        </Link>
      </div>
    </div>
  );
}
