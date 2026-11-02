import Link from "next/link";
import { CREATOR_GITHUB, CREATOR_NAME } from "@/lib/site";

/** One-line authorship credit used in footers. Links to the About page and the creator's GitHub. */
export function Credit({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted ${className}`}>
      Designed &amp; built by{" "}
      <a href={CREATOR_GITHUB} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
        {CREATOR_NAME}
      </a>{" "}
      ·{" "}
      <Link href="/about" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
        About this project
      </Link>
    </p>
  );
}
