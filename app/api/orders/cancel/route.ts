import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/auth/store";
import { cancelOrder } from "@/lib/cancel";
import { checkAuthLimit } from "@/lib/ratelimit";

// Cancel one of YOUR orders (within the cancellation window) and record the full refund. Sign-in required; the order
// must be yours. This is a plain button-driven endpoint — the AI has no cancel or refund tool.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Please sign in to cancel an order." }, { status: 401 });
  if (!checkAuthLimit(`cancel:${user.id}`)) return Response.json({ ok: false, error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });

  let body: { orderId?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const r = await cancelOrder(getStore(), user.id, body.orderId);
  if (!r.ok) return Response.json({ ok: false, error: r.error }, { status: r.status });
  return Response.json({ ok: true, orderId: r.order.id, refund: r.refund });
}
