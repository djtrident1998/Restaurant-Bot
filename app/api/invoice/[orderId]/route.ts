import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/auth/store";
import { buildInvoiceData, renderInvoicePdf } from "@/lib/invoice";

// Download the PDF invoice for one of YOUR orders. Sign-in required; someone else's order id is just a 404.
export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params;
  if (!/^[A-Za-z0-9-]{1,30}$/.test(orderId)) return Response.json({ error: "Invalid order id." }, { status: 400 });

  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in to download an invoice." }, { status: 401 });

  const record = await getStore().findById(user.id);
  const order = record?.orders.find((o) => o.id === orderId);
  if (!record || !order) return Response.json({ error: "We couldn't find that order on your account." }, { status: 404 });

  const pdf = await renderInvoicePdf(buildInvoiceData({ name: record.name, email: record.email }, order));
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Spice-Route-Invoice-${order.id}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
