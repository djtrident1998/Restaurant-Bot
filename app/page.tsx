import Image from "next/image";
import Link from "next/link";
import { LandingHeader } from "@/components/LandingHeader";
import { COPPER_PHOTO, FEAST_PHOTO, HERO_PHOTO, TANDOOR_PHOTO, photoUrl } from "@/lib/images";
import { getItem } from "@/lib/menu";

const SIGNATURE = ["nv-01", "vm-02", "st-01", "rb-02"].map((id) => getItem(id)!);

const PILLARS = [
  { glyph: "🔥", title: "Tandoor-fired", text: "Breads and kebabs kissed by a clay oven that never cools." },
  { glyph: "✦", title: "Slow-cooked", text: "Gravies simmered for hours until every spice has found its place." },
  { glyph: "🌿", title: "Spice-led", text: "Whole spices, ground fresh, balanced from mild to fiery." },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* ───────── Hero ───────── */}
      <section className="relative isolate flex min-h-[100svh] flex-col">
        <Image unoptimized priority fill src={photoUrl(HERO_PHOTO, 2200)} alt="The Spice Route dining room, warmly lit" className="-z-10 object-cover" sizes="100vw" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/80 via-black/55 to-ink" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.45)_0%,transparent_55%,rgba(0,0,0,0.6)_100%)]" />
        <LandingHeader />

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-5 pb-24 pt-32 text-center">
          <p className="fade-up text-xs uppercase tracking-[0.45em] text-gold sm:text-sm">North Indian Fine Dining</p>
          <h1 className="font-display fade-up mt-5 text-6xl leading-[0.95] tracking-tight text-ivory [animation-delay:120ms] sm:text-8xl">
            Spice <span className="italic text-gold-soft">Route</span>
          </h1>
          <div className="ornament fade-up mt-7 w-64 [animation-delay:220ms]">✦</div>
          <p className="fade-up mt-6 max-w-xl text-lg leading-relaxed text-ivory/85 [animation-delay:300ms] sm:text-xl">
            An evening along the old spice road — saffron, smoke and slow-cooked tradition, served by a waiter who knows every dish.
          </p>
          <div className="fade-up mt-10 flex flex-col items-center gap-3 [animation-delay:420ms] sm:flex-row">
            <Link href="/order" className="btn-gold px-9 py-3.5 text-base">
              Order with our AI waiter
            </Link>
            <Link href="#signature" className="btn-ghost bg-black/30 px-9 py-3.5 text-base backdrop-blur">
              Discover the menu
            </Link>
          </div>
        </div>

        <a href="#story" aria-label="Scroll to learn more" className="absolute bottom-6 left-1/2 -translate-x-1/2 text-gold/80 transition hover:text-gold">
          <span className="block animate-bounce text-2xl">⌄</span>
        </a>
      </section>

      {/* ───────── Story ───────── */}
      <section id="story" className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-24 sm:px-8 md:grid-cols-2 md:gap-16">
        <div className="relative aspect-[4/5] overflow-hidden rounded-[28px] border border-gold/30 shadow-[0_30px_80px_-30px_rgba(201,162,77,0.35)]">
          <Image unoptimized src={photoUrl(COPPER_PHOTO, 900, 1100)} alt="Curry served in a copper handi" fill className="object-cover" sizes="(min-width:768px) 45vw, 100vw" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.4em] text-gold">Our story</p>
          <h2 className="font-display mt-3 text-4xl leading-tight text-ivory sm:text-5xl">Cooked the way it has always been done</h2>
          <p className="mt-5 leading-relaxed text-muted">
            Spice Route celebrates the kitchens of North India: dal simmered overnight, breads blistered in the tandoor, biryani sealed and steamed in its own aroma. Every
            dish is made to be shared and remembered.
          </p>
          <p className="mt-4 leading-relaxed text-muted">
            Tonight, your waiter is an AI — it will guide you through the menu course by course, remember your dietary needs, and place your order when you are ready.
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-3">
            {PILLARS.map((p) => (
              <li key={p.title}>
                <div className="text-2xl text-gold">{p.glyph}</div>
                <h3 className="font-display mt-2 text-lg text-ivory">{p.title}</h3>
                <p className="mt-1 text-sm text-muted">{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── Signature dishes ───────── */}
      <section id="signature" className="border-y border-line bg-panel/60 py-24">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.4em] text-gold">From the kitchen</p>
            <h2 className="font-display mt-3 text-4xl text-ivory sm:text-5xl">Signature dishes</h2>
            <div className="ornament mx-auto mt-5 w-56">◆</div>
          </div>
          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SIGNATURE.map((d) => (
              <article key={d.id} className="card group overflow-hidden transition hover:-translate-y-1 hover:border-gold/60">
                <div className="relative aspect-[4/5] overflow-hidden">
                  <Image unoptimized src={photoUrl(d.image, 700, 880)} alt={d.name} fill className="object-cover transition duration-700 group-hover:scale-105" sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 100vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-4">
                    <h3 className="font-display text-xl text-ivory">{d.name}</h3>
                    <p className="mt-1 line-clamp-2 text-sm text-ivory/75">{d.description}</p>
                    <p className="font-display mt-2 text-lg text-gold-soft">₹{d.price}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-12 text-center">
            <Link href="/order" className="btn-gold inline-block px-9 py-3.5 text-base">
              Browse the full menu
            </Link>
          </div>
        </div>
      </section>

      {/* ───────── Feast banner ───────── */}
      <section className="relative isolate overflow-hidden py-32">
        <Image unoptimized fill src={photoUrl(FEAST_PHOTO, 2000)} alt="A table laden with Indian dishes" className="-z-10 object-cover" sizes="100vw" />
        <div className="absolute inset-0 -z-10 bg-black/70" />
        <div className="mx-auto max-w-3xl px-5 text-center">
          <h2 className="font-display text-4xl text-ivory sm:text-6xl">Your table awaits</h2>
          <p className="mx-auto mt-5 max-w-xl text-lg text-ivory/80">Choose your course, and let the evening unfold.</p>
          <Link href="/order" className="btn-gold mt-9 inline-block px-10 py-4 text-base">
            Start your order
          </Link>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-line bg-ink">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-5 py-12 text-center sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="text-gold">✦</span>
            <span className="font-display text-xl tracking-[0.18em] text-ivory">SPICE ROUTE</span>
          </div>
          <div className="relative h-14 w-24 overflow-hidden rounded-lg border border-line opacity-80">
            <Image unoptimized src={photoUrl(TANDOOR_PHOTO, 200, 120)} alt="" fill className="object-cover" sizes="96px" />
          </div>
          <p className="max-w-md text-xs leading-relaxed text-muted">
            A demonstration restaurant experience with an AI waiter. Food photography from Unsplash is illustrative and may not show the exact dish.
          </p>
        </div>
      </footer>
    </div>
  );
}
