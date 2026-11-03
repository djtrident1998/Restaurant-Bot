// What the browser sends back to the server with each chat message. The conversation on screen keeps everything (menu cards,
// order cards), but the server only needs recent text, plus two tiny facts so "cancel it" knows what it refers to: that an
// order was just placed, or which booking was just made. Everything else (big menu results) is left out, so a long chat never
// outgrows the request-size limit. Browser-safe and pure.
import { getToolName, isToolUIPart, type UIMessage } from "ai";

type Part = UIMessage["parts"][number];

/** How many recent messages are sent (the server keeps the same number as its own history window). */
export const HISTORY_MESSAGES = 30;

export function slimHistory(messages: UIMessage[], keep = HISTORY_MESSAGES): UIMessage[] {
  return messages.slice(-keep).map((m) => {
    const parts: Part[] = [];
    for (const p of m.parts) {
      if (p.type === "text") {
        parts.push(p);
        continue;
      }
      if (!isToolUIPart(p) || p.state !== "output-available") continue;
      const name = getToolName(p);
      const out = p.output as { ok?: boolean; orderId?: string; booking?: { id?: string } } | undefined;
      if (name === "place_order" && out?.ok) parts.push({ ...p, input: {}, output: { ok: true, orderId: out.orderId } } as Part);
      else if (name === "booking_done" && out?.ok && out.booking?.id) parts.push({ ...p, input: {}, output: { ok: true, booking: { id: out.booking.id } } } as Part);
    }
    return { ...m, parts };
  });
}
