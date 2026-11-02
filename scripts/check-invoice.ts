import { decodePDFRawStream, PDFDocument, PDFRawStream } from "pdf-lib";
import { buildInvoiceData, businessFromEnv, fitToWidth, invoiceNumberFor, pdfSafe, renderInvoicePdf } from "../lib/invoice";
import type { OrderRecord } from "../lib/auth/store";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};
const hex = (s: string) => Buffer.from(s, "latin1").toString("hex").toUpperCase();

// pdf-lib compresses page content, so decode every stream before looking for the drawn text (stored as hex strings).
const cache = new WeakMap<Uint8Array, Promise<string>>();
async function pdfText(bytes: Uint8Array): Promise<string> {
  const doc = await PDFDocument.load(bytes);
  let out = "";
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) out += Buffer.from(decodePDFRawStream(obj).decode()).toString("latin1") + "\n";
  }
  return out.toUpperCase();
}
const texts = new Map<Uint8Array, string>();
async function load(bytes: Uint8Array) {
  texts.set(bytes, await pdfText(bytes));
  return bytes;
}
void cache;
const has = (bytes: Uint8Array, s: string) => (texts.get(bytes) ?? "").includes(hex(s));

const order: OrderRecord = {
  id: "SR-4977",
  total: 545,
  placedAt: Date.UTC(2026, 10, 1, 17, 47), // 1 Nov 2026 23:17 IST
  lines: [
    { name: "Chana Masala", qty: 2, lineTotal: 440 },
    { name: "Tandoori Roti", qty: 3, lineTotal: 105 },
  ],
};
const user = { name: "Asha Verma", email: "asha@example.com" };

(async () => {
  // ---- data ----
  const d = buildInvoiceData(user, order, { name: "Spice Route", tagline: "North Indian Fine Dining" });
  check("invoice number derives from the order id", d.invoiceNumber === "INV-SR-4977" && invoiceNumberFor("SR-4977") === d.invoiceNumber);
  check("unit price = line total / qty (220 and 35)", d.lines[0].unit === 220 && d.lines[1].unit === 35);
  check("total is recomputed from the lines and matches the order", d.total === 545 && d.total === order.total);
  check("date is shown in Indian time", /2026/.test(d.date) && /IST$/.test(d.date) && /11:17/.test(d.date), d.date);
  check("customer details come from the account", d.customer.name === "Asha Verma" && d.customer.email === "asha@example.com");
  check("business tax id / address are optional and never invented", businessFromEnv({} as NodeJS.ProcessEnv).taxId === undefined && businessFromEnv({} as NodeJS.ProcessEnv).address === undefined);
  check("business details can come from env", businessFromEnv({ INVOICE_BUSINESS_NAME: "Acme", INVOICE_TAX_ID: "TAX123" } as unknown as NodeJS.ProcessEnv).taxId === "TAX123");

  // ---- the PDF ----
  const pdf = await load(await renderInvoicePdf(d));
  check("output is a real PDF", Buffer.from(pdf.slice(0, 5)).toString() === "%PDF-" && pdf.length > 1500, `(${pdf.length} bytes)`);
  const doc = await PDFDocument.load(pdf);
  check("one A4 page", doc.getPageCount() === 1 && Math.round(doc.getPage(0).getWidth()) === 595 && Math.round(doc.getPage(0).getHeight()) === 842);
  check("title metadata carries the invoice number", doc.getTitle() === "Invoice INV-SR-4977");
  check("PDF contains the invoice number, items, customer and total", has(pdf, "INV-SR-4977") && has(pdf, "Chana Masala") && has(pdf, "Tandoori Roti") && has(pdf, "Asha Verma") && has(pdf, "Rs. 545"));
  check("PDF states it is not a tax invoice (no invented tax claims)", has(pdf, "not a tax invoice") && !has(pdf, "GSTIN"));

  // ---- robustness ----
  const weird = await load(await renderInvoicePdf(buildInvoiceData({ name: "आशा Verma 😀", email: "a@b.co" }, order)));
  check("non-Latin names don't crash the PDF (shown as ?)", weird.length > 1500 && has(weird, "Verma"));
  check("pdfSafe replaces unsupported characters and caps length", pdfSafe("Café ₹ आ") === "Café ? ?" && pdfSafe("x".repeat(200), 10).length === 10);
  const { PDFDocument: PD, StandardFonts: SF } = await import("pdf-lib");
  const probe = await (await PD.create()).embedFont(SF.Helvetica);
  const fitted = fitToWidth("W".repeat(120), probe, 10.5, 260);
  check("very long item names are trimmed to the column width (with ...)", probe.widthOfTextAtSize(fitted, 10.5) <= 260 && fitted.endsWith("..."));
  check("short names are left alone", fitToWidth("Dal Makhani", probe, 10.5, 260) === "Dal Makhani");
  const many: OrderRecord = { ...order, lines: Array.from({ length: 40 }, (_, i) => ({ name: `Dish ${i}`, qty: 1, lineTotal: 10 })), total: 400 };
  check("a very long order still renders without crashing", (await renderInvoicePdf(buildInvoiceData(user, many))).length > 1500);
  const injected = await load(await renderInvoicePdf(buildInvoiceData({ name: "<script>alert(1)</script>", email: "x@y.z" }, order)));
  check("markup in a name is just printed as text", has(injected, "<script>alert(1)</script>"));

  process.exit(fails ? 1 : 0);
})();
