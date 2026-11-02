"use client";

import Link from "next/link";

// Shown if something unexpected breaks while a page renders. No technical details are shown to visitors.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-5 py-20 text-center outline-none">
      <div className="text-6xl" aria-hidden>
        🔥
      </div>
      <h1 className="font-display mt-4 text-3xl text-ivory">Something went wrong in the kitchen</h1>
      <p className="mt-2 text-muted">It&apos;s on us, not you. Your cart and account are safe. Please try again.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-gold px-6 py-3 text-sm">
          Try again
        </button>
        <Link href="/" className="btn-ghost px-6 py-3 text-sm">
          Home
        </Link>
      </div>
    </main>
  );
}
