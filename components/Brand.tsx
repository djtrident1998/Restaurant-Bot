import Link from "next/link";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--gold-deep)] text-base text-white shadow-md transition group-hover:rotate-6" aria-hidden>
        ✦
      </span>
      <span className="whitespace-nowrap text-lg font-extrabold tracking-tight text-ivory min-[420px]:text-xl sm:text-2xl">
        Spice <span className="text-gold-soft">Route</span>
      </span>
    </Link>
  );
}
