import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-5 py-20 text-center outline-none">
        <div className="text-6xl" aria-hidden>
          🍽
        </div>
        <h1 className="font-display mt-4 text-3xl text-ivory">This table doesn&apos;t exist</h1>
        <p className="mt-2 text-muted">The page you were looking for isn&apos;t on our menu. Let&apos;s get you back to the good stuff.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/order" className="btn-gold px-6 py-3 text-sm">
            Order with the AI waiter
          </Link>
          <Link href="/" className="btn-ghost px-6 py-3 text-sm">
            Home
          </Link>
        </div>
      </main>
    </div>
  );
}
