import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";

/** Plain, readable layout for the privacy policy and terms. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 outline-none sm:px-8">
        <h1 className="font-display text-3xl text-ivory sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-ivory/90 [&_a]:font-semibold [&_a]:text-gold-soft [&_a]:underline [&_h2]:font-display [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:text-ivory [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
          {children}
        </div>
      </main>
    </div>
  );
}

export const CONTACT_URL = "https://github.com/djtrident1998/Restaurant-Bot/issues";
