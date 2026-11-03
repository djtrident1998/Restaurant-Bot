import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/auth/store";
import { createBooking } from "@/lib/bookingService";
import { getBookingStore } from "@/lib/bookings/store";
import { checkWindow } from "@/lib/ratelimit";

// Book a table. Sign-in required. The table is chosen by code inside an atomic update; the browser only says when and for how many.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Please sign in to book a table." }, { status: 401 });
  if (!checkWindow(`book:${user.id}`, 10, 10 * 60_000)) return Response.json({ ok: false, error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const r = await createBooking(getBookingStore(), getStore(), { id: user.id, name: user.name }, body);
  if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: r.status });
  return Response.json({ ok: true, booking: r.booking });
}
