import type { Metadata } from "next";
import { BookingForm } from "@/components/BookingForm";
import { Credit } from "@/components/Credit";
import { SiteHeader } from "@/components/SiteHeader";
import { BOOKING, dateError, isUpcoming, todayLocal, validParty } from "@/lib/booking";
import { getCurrentAccount } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Book a table", description: "Reserve a table at Spice Route: pick a date, party size and time, and see live availability." };

export default async function BookPage({ searchParams }: { searchParams: Promise<{ date?: string; party?: string; time?: string }> }) {
  const account = await getCurrentAccount();
  const upcoming = (account?.bookings ?? []).filter((b) => isUpcoming(b)).length;

  // A "Find a table" search from the home page arrives as ?date=&party=&time=. Every value is validated; bad ones are ignored.
  const q = await searchParams;
  const initial: { date?: string; party?: number; time?: string } = {};
  if (q.date && dateError(q.date) === null) initial.date = q.date;
  const party = Number(q.party);
  if (q.party && validParty(party)) initial.party = party;
  if (q.time && (BOOKING.seatings as readonly string[]).includes(q.time)) initial.time = q.time;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 outline-none sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-soft">Dining</p>
        <h1 className="font-display mt-1 text-3xl text-ivory sm:text-4xl">Book a table</h1>
        <p className="mt-2 text-muted">
          Lunch {BOOKING.seatings[0]}–{BOOKING.seatings[5]} and dinner {BOOKING.seatings[6]}–{BOOKING.seatings[13]} (India Standard Time). Pick a time and we hold your table for {BOOKING.durationMin / 60} hours, with {BOOKING.holdMin} minutes&apos; grace if
          you&apos;re running late. Free cancellation until {BOOKING.cancelCutoffMin / 60} hours before. This is a demonstration: no real restaurant is holding a table.
        </p>
        <div className="mt-6">
          <BookingForm today={todayLocal()} signedIn={!!account} upcomingCount={upcoming} initial={initial} />
        </div>
        <Credit className="mt-10 text-center" />
      </main>
    </div>
  );
}
