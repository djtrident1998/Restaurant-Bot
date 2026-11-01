import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/session";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <span className="text-gold transition group-hover:rotate-45">✦</span>
      <span className="font-display text-xl tracking-[0.18em] text-ivory sm:text-2xl">SPICE ROUTE</span>
    </Link>
  );
}

/** Top bar. Reads the signed-in user from the session cookie on the server. `overlay` floats it over the hero photo. */
export async function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const user = await getCurrentUser();
  return (
    <header className={`${overlay ? "absolute inset-x-0 top-0 z-20" : "relative z-20 border-b border-line bg-ink/80 backdrop-blur"}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Brand />
        <nav className="flex items-center gap-2 text-sm sm:gap-3">
          <Link href="/order" className="hidden px-2 text-muted transition hover:text-gold-soft sm:inline">
            Menu &amp; Order
          </Link>
          {user ? (
            <>
              <Link href="/account" className="btn-ghost px-3.5 py-1.5" title="Your account and past orders">
                <span className="hidden sm:inline">Hi, </span>
                {user.name.split(" ")[0]}
              </Link>
              <form action={logout}>
                <button type="submit" className="px-2 py-1.5 text-muted transition hover:text-gold-soft">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="px-2 py-1.5 text-ivory transition hover:text-gold-soft">
                Sign in
              </Link>
              <Link href="/signup" className="btn-gold px-4 py-2 text-sm">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
