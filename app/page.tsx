import Image from "next/image";
import Link from "next/link";
import { LandingHeader } from "@/components/LandingHeader";
import { COPPER_PHOTO, FEAST_PHOTO, HERO_PHOTO, TANDOOR_PHOTO, photoUrl } from "@/lib/images";
import { getItem } from "@/lib/menu";

const SIGNATURE = ["nv-01", "vm-02", "st-01", "rb-02"].map((id) => getItem(id)!);

const CATEGORIES = [
  { emoji: "🍢", label: "Starters" },
  { emoji: "🍛", label: "Main Course" },
  { emoji: "🫓", label: "Breads & Rice" },
  { emoji: "🍮", label: "Desserts" },
  { emoji: "🥤", label: "Drinks" },
];

const STEPS = [
  { glyph: "💬", title: "Ask your waiter", text: "Type or speak: “something mild without nuts”, “vegan under ₹300”. Answers come straight from the real menu." },
  { glyph: "🛒", title: "Build your order", text: "Pick a category, set the quantity and tap ADD. Totals are calculated for you, to the rupee." },
  { glyph: "🤝", title: "Order & split", text: "Confirm with one tap, then split the bill between friends — equally or dish by dish." },
];

const PERKS = [
  { glyph: "🎙️", title: "Voice ordering", text: "Say “place order” and it works like the button." },
  { glyph: "👥", title: "Group orders", text: "Divide the bill and keep track of who has paid." },
  { glyph: "↩️", title: "Easy cancellation", text: "Cancel within minutes of ordering for a full refund." },
  { glyph: "🧾", title: "PDF invoices", text: "Download an invoice for every order." },
];

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* ───────── Hero (dark, on a photo) ───────── */}
      <section className="theme-dark relative isolate flex min-h-[100svh] flex-col">
        <Image unoptimized priority fill src={photoUrl(HERO_PHOTO, 2200)} alt="The Spice Route dining room, warmly lit" className="-z-10 object-cover" sizes="100vw" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/80 via-black/55 to-black/85" />
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(0,0,0,0.4)_0%,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
        <LandingHeader />

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-5 pb-24 pt-32 text-center">
          <p className="fade-up inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.25em] text-white backdrop-blur sm:text-sm">
            North Indian Fine Dining · AI Waiter
          </p>
          <h1 className="font-display fade-up mt-6 text-6xl leading-[0.95] tracking-tight text-ivory [animation-delay:120ms] sm:text-8xl">
            Spice <span className="italic text-gold-soft">Route</span>
          </h1>
          <p className="fade-up mt-6 max-w-xl text-lg leading-relaxed text-ivory/90 [animation-delay:260ms] sm:text-xl">
            Hungry? Tell our AI waiter what you fancy. Order for yourself or the whole table — and split the bill in a tap.
          </p>
          <div className="fade-up mt-10 flex flex-col items-center gap-3 [animation-delay:400ms] sm:flex-row">
            <Link href="/order" className="btn-gold px-9 py-3.5 text-base">
              Order now
            </Link>
            <Link href="#how" className="btn-ghost bg-white/10 px-9 py-3.5 text-base text-white backdrop-blur">
              How it works
            </Link>
          </div>
        </div>

        <a href="#categories" aria-label="Scroll to learn more" className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 transition hover:text-white">
          <span className="block animate-bounce text-2xl">⌄</span>
        </a>
      </section>

      {/* ───────── What's on your mind ───────── */}
      <section id="categories" className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
        <h2 className="font-display text-2xl text-ivory sm:text-3xl">What&apos;s on your mind?</h2>
        <div className="mt-6 flex gap-5 overflow-x-auto pb-2 sm:gap-8">
          {CATEGORIES.map((c) => (
            <Link key={c.label} href="/order" className="cat-tile shrink-0">
              <span className="cat-icon !h-20 !w-20 !text-4xl" aria-hidden>
                {c.emoji}
              </span>
              <span className="text-sm font-semibold text-ivory">{c.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ───────── Signature dishes ───────── */}
      <section id="signature" className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-2xl text-ivory sm:text-3xl">Signature dishes</h2>
          <Link href="/order" className="text-sm font-semibold text-gold-soft underline-offset-4 hover:underline">
            See full menu →
          </Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {SIGNATURE.map((d) => (
            <article key={d.id} className="card group overflow-hidden transition hover:-translate-y-1">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image unoptimized src={photoUrl(d.image, 700, 540)} alt={d.name} fill className="object-cover transition duration-700 group-hover:scale-105" sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 100vw" />
                <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2 py-1 text-xs font-bold text-ivory shadow">Chef&apos;s pick</span>
              </div>
              <div className="p-4">
                <h3 className="text-lg font-bold text-ivory">{d.name}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{d.description}</p>
                <p className="mt-3 text-lg font-bold text-ivory">₹{d.price}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ───────── How it works ───────── */}
      <section id="how" className="border-y border-line bg-panel py-16">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <h2 className="font-display text-center text-2xl text-ivory sm:text-3xl">Order in three easy steps</h2>
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-line bg-panel2 p-6">
                <span className="absolute -top-3 left-5 rounded-full bg-gold px-3 py-0.5 text-xs font-bold text-white">Step {i + 1}</span>
                <div className="text-3xl" aria-hidden>
                  {s.glyph}
                </div>
                <h3 className="mt-3 text-lg font-bold text-ivory">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ul>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PERKS.map((p) => (
              <li key={p.title} className="flex items-start gap-3 rounded-2xl border border-line bg-panel p-4">
                <span className="text-2xl" aria-hidden>
                  {p.glyph}
                </span>
                <div>
                  <h3 className="font-bold text-ivory">{p.title}</h3>
                  <p className="text-sm text-muted">{p.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ───────── Story ───────── */}
      <section id="story" className="mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 md:grid-cols-2 md:gap-14">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-xl">
          <Image unoptimized src={photoUrl(COPPER_PHOTO, 1000, 760)} alt="Curry served in a copper handi" fill className="object-cover" sizes="(min-width:768px) 45vw, 100vw" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-gold-soft">Our story</p>
          <h2 className="font-display mt-2 text-3xl leading-tight text-ivory sm:text-4xl">Cooked the way it has always been done</h2>
          <p className="mt-4 leading-relaxed text-muted">
            Spice Route celebrates the kitchens of North India: dal simmered overnight, breads blistered in the tandoor, biryani sealed and steamed in its own aroma. Every
            dish is made to be shared and remembered.
          </p>
          <p className="mt-3 leading-relaxed text-muted">Tonight, your waiter is an AI — it guides you through the menu, remembers your dietary needs, and places your order when you are ready.</p>
        </div>
      </section>

      {/* ───────── CTA banner ───────── */}
      <section className="theme-dark relative isolate overflow-hidden py-24">
        <Image unoptimized fill src={photoUrl(FEAST_PHOTO, 2000)} alt="A table laden with Indian dishes" className="-z-10 object-cover" sizes="100vw" />
        <div className="absolute inset-0 -z-10 bg-black/70" />
        <div className="mx-auto max-w-3xl px-5 text-center">
          <h2 className="font-display text-4xl text-ivory sm:text-5xl">Your table awaits</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-ivory/85">Bring the whole table. Order together, split the bill, and enjoy the evening.</p>
          <Link href="/order" className="btn-gold mt-8 inline-block px-10 py-4 text-base">
            Start your order
          </Link>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-line bg-panel">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-10 text-center sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--gold-deep)] text-white" aria-hidden>
              ✦
            </span>
            <span className="text-xl font-extrabold tracking-tight text-ivory">
              Spice <span className="text-gold-soft">Route</span>
            </span>
          </div>
          <div className="relative h-12 w-20 overflow-hidden rounded-lg border border-line">
            <Image unoptimized src={photoUrl(TANDOOR_PHOTO, 200, 120)} alt="" fill className="object-cover" sizes="80px" />
          </div>
          <p className="max-w-md text-xs leading-relaxed text-muted">
            A demonstration restaurant experience with an AI waiter. No real payments are taken. Food photography from Unsplash is illustrative and may not show the exact dish.
          </p>
        </div>
      </footer>
    </div>
  );
}
