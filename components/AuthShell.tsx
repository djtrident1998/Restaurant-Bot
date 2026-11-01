import Image from "next/image";
import type { ReactNode } from "react";
import { HERO_PHOTO, photoUrl } from "@/lib/images";
import { SiteHeader } from "./SiteHeader";

/** Full-bleed photo backdrop with a centred glass card — used by the sign-in and sign-up pages. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <Image unoptimized priority fill src={photoUrl(HERO_PHOTO, 1800)} alt="" className="-z-10 object-cover" sizes="100vw" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/80 via-black/70 to-black/90" />
      <SiteHeader overlay />
      <main className="flex flex-1 items-center justify-center px-4 py-24">
        <div className="fade-up w-full max-w-md rounded-3xl border border-gold/40 bg-black/65 p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-md sm:p-9">
          <div className="text-center">
            <div className="text-xl text-gold">✦</div>
            <h1 className="font-display mt-1 text-3xl text-ivory">{title}</h1>
            <p className="mt-2 text-sm text-muted">{subtitle}</p>
          </div>
          <div className="ornament my-5 text-xs">◆</div>
          {children}
        </div>
      </main>
    </div>
  );
}
