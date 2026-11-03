import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/auth/store";
import { cancelBooking } from "@/lib/bookingService";
import { getBookingStore } from "@/lib/bookings/store";
import { checkWindow } from "@/lib/ratelimit";

// Cancel one of YOUR table bookings (up to 2 hours before). Frees the table.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Please sign in to cancel a booking." }, { status: 401 });
  if (!checkWindow(`bookcancel:${user.id}`, 20, 10 * 60_000)) return Response.json({ ok: false, error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });

  let body: { id?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const r = await cancelBooking(getBookingStore(), getStore(), user.id, body.id);
  if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: r.status });
  return Response.json({ ok: true, booking: r.booking });
}
