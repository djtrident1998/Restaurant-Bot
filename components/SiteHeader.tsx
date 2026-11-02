import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { getCurrentUser } from "@/lib/auth/session";
import { Brand } from "./Brand";

export { Brand };

/** Top bar. Reads the signed-in user from the session cookie on the server. `overlay` floats it over the hero photo. */
export async function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const user = await getCurrentUser();
  return (
    <header className={`${overlay ? "absolute inset-x-0 top-0 z-20" : "relative z-20 border-b border-line bg-ink/80 backdrop-blur"}`}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Brand />
        <nav className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs min-[420px]:gap-2 min-[420px]:text-sm sm:gap-3">
          <Link href="/order" className="hidden px-2 text-muted transition hover:text-gold-soft sm:inline">
            Menu &amp; Order
          </Link>
          {user ? (
            <>
              <Link href="/account" className="btn-ghost px-3.5 py-1.5" title="Your account and past orders">
                <span className="hidden sm:inline">Hi, </span>
                <span className="inline-block max-w-[6.5rem] truncate align-bottom">{user.name.split(" ")[0]}</span>
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
              <Link href="/signup" className="btn-gold px-3 py-1.5 text-xs min-[420px]:px-4 min-[420px]:py-2 min-[420px]:text-sm">
                <span className="min-[420px]:hidden">Join</span>
                <span className="hidden min-[420px]:inline">Create account</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
