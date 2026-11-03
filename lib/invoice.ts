import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { OrderRecord } from "./auth/store";
import { serviceShort } from "./service";

export interface InvoiceData {
  business: { name: string; tagline: string; address?: string; taxId?: string };
  invoiceNumber: string;
  orderId: string;
  date: string;
  customer: { name: string; email: string };
  lines: { name: string; qty: number; unit: number; amount: number }[];
  total: number;
  /** "Delivery" or "Dine in · booking BK-…" */
  service: string;
  /** Present when the order was cancelled: the invoice is stamped CANCELLED and shows the refund. */
  cancelled?: { date: string; refundAmount: number; refundRef: string };
}

export const invoiceNumberFor = (orderId: string) => `INV-${orderId}`;

/** Business details come from env (optional) so real address / tax id can be added without code changes. Nothing is invented. */
export function businessFromEnv(env: NodeJS.ProcessEnv = process.env): InvoiceData["business"] {
  return {
    name: env.INVOICE_BUSINESS_NAME || "Spice Route",
    tagline: "North Indian Fine Dining",
    address: env.INVOICE_ADDRESS || undefined,
    taxId: env.INVOICE_TAX_ID || undefined,
  };
}

export function formatInvoiceDate(ms: number): string {
  return new Date(ms).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }) + " IST";
}

/** Everything printed on the invoice, taken from the stored order. Totals are recomputed from the lines (code math). */
export function buildInvoiceData(
  user: { name: string; email: string },
  order: OrderRecord,
  business: InvoiceData["business"] = businessFromEnv(),
): InvoiceData {
  const lines = order.lines.map((l) => ({ name: l.name, qty: l.qty, unit: l.qty > 0 ? Math.round(l.lineTotal / l.qty) : l.lineTotal, amount: l.lineTotal }));
  return {
    business,
    invoiceNumber: invoiceNumberFor(order.id),
    orderId: order.id,
    date: formatInvoiceDate(order.placedAt),
    customer: { name: user.name, email: user.email },
    lines,
    total: lines.reduce((n, l) => n + l.amount, 0),
    service: serviceShort(order.service ?? { type: "delivery" }),
    cancelled: order.cancelledAt
      ? { date: formatInvoiceDate(order.cancelledAt), refundAmount: order.refund?.amount ?? order.total, refundRef: order.refund?.ref ?? "" }
      : undefined,
  };
}

// The standard PDF fonts only cover Latin-1; anything else (e.g. Devanagari names) becomes "?" instead of crashing.
export const pdfSafe = (s: string, max = 60) => s.replace(/[^\x20-\x7E\xA0-\xFF]/g, "?").slice(0, max);
/** Shorten `s` (adding "...") until it is at most `maxWidth` points wide in the given font. */
export function fitToWidth(s: string, font: { widthOfTextAtSize(t: string, size: number): number }, size: number, maxWidth: number): string {
  let t = pdfSafe(s, 200);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(t + "...", size) > maxWidth) t = t.slice(0, -1);
  return t + "...";
}
// "₹" is not in the standard fonts, so the PDF uses "Rs.".
const money = (n: number) => `Rs. ${n.toLocaleString("en-IN")}`;

export async function renderInvoicePdf(d: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${d.invoiceNumber}`);
  pdf.setProducer("Spice Route");
  const page = pdf.addPage([595.28, 841.89]); // A4
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.1, 0.09, 0.08);
  const muted = rgb(0.42, 0.4, 0.36);
  const gold = rgb(0.69, 0.53, 0.2);
  const line = rgb(0.85, 0.8, 0.7);
  const M = 50;
  const W = 595.28 - M * 2;
  const text = (s: string, x: number, y: number, size = 10, font = sans, color = ink, max = 80) => page.drawText(pdfSafe(s, max), { x, y, size, font, color });
  const right = (s: string, xRight: number, y: number, size = 10, font = sans, color = ink) => {
    const t = pdfSafe(s, 80);
    page.drawText(t, { x: xRight - font.widthOfTextAtSize(t, size), y, size, font, color });
  };

  // Header
  text(d.business.name.toUpperCase(), M, 780, 26, serif, ink);
  text(d.business.tagline, M, 762, 10, sans, gold);
  let ay = 746;
  if (d.business.address) {
    text(d.business.address, M, ay, 9, sans, muted);
    ay -= 12;
  }
  if (d.business.taxId) text(`Tax ID: ${d.business.taxId}`, M, ay, 9, sans, muted);
  right("INVOICE", M + W, 780, 22, bold, gold);
  right(d.invoiceNumber, M + W, 762, 10, bold);
  right(`Order ${d.orderId}`, M + W, 748, 9, sans, muted);
  right(d.date, M + W, 735, 9, sans, muted);
  page.drawLine({ start: { x: M, y: 715 }, end: { x: M + W, y: 715 }, thickness: 1.2, color: gold });

  // Bill to
  text("BILLED TO", M, 690, 8, bold, gold);
  text(d.customer.name, M, 674, 12, bold);
  text(d.customer.email, M, 659, 10, sans, muted);
  right("ORDER TYPE", M + W, 690, 8, bold, gold);
  right(d.service, M + W, 674, 12, bold);

  // Table
  const colQty = M + W - 190;
  const colRate = M + W - 105;
  const colAmt = M + W;
  let y = 615;
  page.drawRectangle({ x: M, y: y - 6, width: W, height: 22, color: rgb(0.96, 0.93, 0.86) });
  text("ITEM", M + 8, y, 8.5, bold, ink);
  right("QTY", colQty, y, 8.5, bold);
  right("RATE", colRate, y, 8.5, bold);
  right("AMOUNT", colAmt - 8, y, 8.5, bold);
  y -= 26;
  for (const l of d.lines) {
    text(fitToWidth(l.name, sans, 10.5, colQty - 36 - (M + 8)), M + 8, y, 10.5, sans, ink); // trimmed to the measured width so it can't run into the Qty column
    right(String(l.qty), colQty, y, 10.5);
    right(money(l.unit), colRate, y, 10.5);
    right(money(l.amount), colAmt - 8, y, 10.5);
    page.drawLine({ start: { x: M, y: y - 8 }, end: { x: M + W, y: y - 8 }, thickness: 0.5, color: line });
    y -= 24;
    if (y < 150) break; // a single order never has this many lines; stop rather than run off the page
  }

  // Total
  y -= 6;
  page.drawRectangle({ x: M + W - 210, y: y - 10, width: 210, height: 30, color: rgb(0.1, 0.09, 0.08) });
  text("TOTAL", M + W - 198, y, 10, bold, rgb(0.9, 0.78, 0.5));
  right(money(d.total), colAmt - 8, y - 1, 13, bold, rgb(0.96, 0.9, 0.78));

  // Cancelled orders: stamp + refund line
  if (d.cancelled) {
    page.drawRectangle({ x: M, y: y - 10, width: 200, height: 30, borderColor: rgb(0.7, 0.15, 0.15), borderWidth: 1.5, color: rgb(1, 1, 1) });
    text("CANCELLED", M + 38, y, 14, bold, rgb(0.7, 0.15, 0.15));
    y -= 38;
    text(`Cancelled on ${d.cancelled.date}`, M, y, 9, sans, muted);
    y -= 14;
    text(`Refund of ${money(d.cancelled.refundAmount)} recorded${d.cancelled.refundRef ? ` (ref ${d.cancelled.refundRef})` : ""}. Amount payable: ${money(0)}.`, M, y, 9, bold, ink, 120);
  }

  // Notes
  const notes = [
    "Thank you for dining with Spice Route.",
    "Prices are in Indian rupees (INR) as listed on the menu. No online payment was taken for this order.",
    "This is a demonstration restaurant experience; this document is not a tax invoice.",
  ];
  let ny = 110;
  for (const n of notes) {
    text(n, M, ny, 8, sans, muted, 200); // full sentences (the page is wide enough at this size)
    ny -= 12;
  }
  page.drawLine({ start: { x: M, y: 128 }, end: { x: M + W, y: 128 }, thickness: 0.6, color: line });

  return pdf.save();
}
