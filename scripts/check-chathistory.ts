// Offline test of what the browser sends back to the server: recent text plus two tiny facts, never the big menu results.
import type { UIMessage } from "ai";
import { HISTORY_MESSAGES, slimHistory } from "../lib/chatHistory";
import { getLimits } from "../lib/config";
import { resolveBookingRequest } from "../lib/bookingIntent";
import { detectCancelIntent } from "../lib/cancel";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

const bigMenu = { ok: true, items: Array.from({ length: 8 }, (_, i) => ({ id: `d${i}`, name: `Dish ${i}`, description: "x".repeat(400), image: "https://images.unsplash.com/" + "y".repeat(200) })) };
const user = (i: number, text: string): UIMessage => ({ id: `u${i}`, role: "user", parts: [{ type: "text", text }] });
const waiter = (i: number, text: string, tools: unknown[] = []): UIMessage => ({ id: `a${i}`, role: "assistant", parts: [{ type: "text", text }, ...tools] as UIMessage["parts"] });
const tool = (name: string, output: unknown) => ({ type: `tool-${name}`, toolCallId: `c-${name}`, state: "output-available", input: { big: "z".repeat(500) }, output });

(async () => {
  // a long chat full of menu cards
  const long: UIMessage[] = [];
  for (let i = 0; i < 120; i++) {
    long.push(user(i, `show me the menu ${i}`));
    long.push(waiter(i, "Here are our dishes", [tool("search_menu", bigMenu)]));
  }
  const full = JSON.stringify({ sessionId: "s-abc12345-dl", messages: long }).length;
  const slim = slimHistory(long);
  const slimSize = JSON.stringify({ sessionId: "s-abc12345-dl", messages: slim }).length;
  check("only the most recent messages are sent", slim.length === HISTORY_MESSAGES && slim.at(-1)?.id === long.at(-1)?.id);
  check("a long chat with menu cards would have broken the request-size limit", full > getLimits().maxBodyBytes, `${full} bytes vs limit ${getLimits().maxBodyBytes}`);
  check("slimmed, the same chat is tiny and well under the limit", slimSize < 20_000 && slimSize < getLimits().maxBodyBytes / 10, `${slimSize} bytes`);
  check("text is kept word for word", slim.every((m, i) => JSON.stringify(m.parts.filter((p) => p.type === "text")) === JSON.stringify(long.slice(-HISTORY_MESSAGES)[i].parts.filter((p) => p.type === "text"))));
  check("big menu results are not sent", !JSON.stringify(slim).includes("Dish 3") && !JSON.stringify(slim).includes("unsplash"));

  // the two facts "cancel it" needs
  const placed = slimHistory([user(1, "yes"), waiter(1, "Your order is placed", [tool("place_order", { ok: true, orderId: "SR-1234", cart: bigMenu })])]);
  const placedPart = placed[1].parts.find((p) => p.type === "tool-place_order") as { output?: { orderId?: string; cart?: unknown } } | undefined;
  check("a placed order is remembered as just a flag and its id", placedPart?.output?.orderId === "SR-1234" && placedPart.output.cart === undefined);
  const booked = slimHistory([waiter(1, "Done", [tool("booking_done", { ok: true, booking: { id: "BK-261107-204", date: "2026-11-07", table: "T5", notes: "private" } })])]);
  const bookedPart = booked[0].parts.find((p) => p.type === "tool-booking_done") as { output?: { booking?: { id?: string; notes?: string } } } | undefined;
  check("a made booking is remembered as just its id (nothing personal)", bookedPart?.output?.booking?.id === "BK-261107-204" && bookedPart.output.booking.notes === undefined);
  check("failed or other tool results are dropped", slimHistory([waiter(1, "x", [tool("place_order", { ok: false })])])[0].parts.length === 1);

  // the server still reads "cancel it" correctly from the slimmed history
  check("after a placed order, 'cancel it' is an order cancel", detectCancelIntent("cancel it", true) !== null);
  check("after a made booking, 'cancel it' is a booking cancel", resolveBookingRequest(["cancel it"], null, "2026-11-03", true)?.kind === "cancel");

  // the history window is wider than before
  check("the history window is 30 messages and the text budget is wider", HISTORY_MESSAGES === 30 && getLimits().maxHistoryTotalChars >= 8000 && getLimits().maxHistoryMsgChars >= 800);

  console.log(fails === 0 ? "\nAll chat history checks passed" : `\n${fails} FAILED`);
  process.exit(fails === 0 ? 0 : 1);
})();
