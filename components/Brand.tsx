import Link from "next/link";

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 ${className}`}>
      <span className="text-gold transition group-hover:rotate-45">✦</span>
      <span className="font-display whitespace-nowrap text-base tracking-[0.14em] text-ivory min-[420px]:text-xl sm:text-2xl sm:tracking-[0.18em]">SPICE ROUTE</span>
    </Link>
  );
}
