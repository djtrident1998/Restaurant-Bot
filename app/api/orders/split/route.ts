import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/auth/store";
import { checkWindow } from "@/lib/ratelimit";
import { saveSplit, setSharePaid } from "@/lib/splitOrder";

// Divide one of YOUR orders between people, and record who has paid their share. Sign-in required; the order must be
// yours. Amounts are recomputed from the stored order, so the browser can't change what anyone owes.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Please sign in to split a bill." }, { status: 401 });
  if (!checkWindow(`split:${user.id}`, 60, 10 * 60_000)) return Response.json({ ok: false, error: "Too many changes. Please try again in a few minutes." }, { status: 429 });

  let body: { action?: unknown; orderId?: unknown; spec?: unknown; index?: unknown; paid?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const r = body.action === "paid" ? await setSharePaid(getStore(), user.id, body.orderId, body.index, body.paid) : await saveSplit(getStore(), user.id, body.orderId, body.spec);
  if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: r.status });
  return Response.json({ ok: true, orderId: r.order.id, split: r.order.split });
}
