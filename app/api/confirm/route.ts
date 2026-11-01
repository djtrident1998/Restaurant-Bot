import { userConfirm, viewCart } from "@/lib/cart";

// Called ONLY by the UI's "Yes, place order" button. This is the server-side proof of consent that
// place_order requires; it is intentionally not a model tool, so the model cannot confirm for the customer.
export async function POST(req: Request) {
  let sessionId = "";
  try {
    sessionId = String((await req.json()).sessionId ?? "");
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!/^[\w-]{8,64}$/.test(sessionId)) return Response.json({ error: "bad sessionId" }, { status: 400 });
  if (!userConfirm(sessionId)) return Response.json({ ok: false, error: "Your cart is empty." }, { status: 409 });
  return Response.json({ ok: true, cart: viewCart(sessionId) });
}
