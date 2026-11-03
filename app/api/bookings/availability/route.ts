import { getBookingStore } from "@/lib/bookings/store";
import { getAvailability } from "@/lib/bookingService";
import { checkWindow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

// Which times are free for a date and party size. Open to everyone (you can look before you sign in).
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkWindow(`avail:${ip}`, 120, 10 * 60_000)) return Response.json({ ok: false, error: "Too many requests. Please wait a moment." }, { status: 429 });
  const url = new URL(req.url);
  const r = await getAvailability(getBookingStore(), url.searchParams.get("date"), url.searchParams.get("party") ?? 2);
  if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: 400 });
  return Response.json({ ok: true, date: r.date, party: r.party, slots: r.slots }, { headers: { "Cache-Control": "no-store" } });
}
