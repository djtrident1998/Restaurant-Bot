// Spoken / typed ordering commands, recognised in the browser (client-safe, pure, unit-tested).
// They map to the SAME actions as the buttons: checkout read-back, confirm, change. The server still decides:
// it requires a signed-in session and a recorded confirmation for the exact cart, and the AI can never confirm.
//
// Matching is deliberately strict (whole short phrases only, no negations) so ordinary conversation —
// "no, don't place the order yet", "is the order spicy?" — never triggers anything.

export type OrderCommand = "checkout" | "confirm" | "change" | null;

const FILLER = /^(?:(?:ok|okay|alright|right|so|hey|hi|please|kindly|yes and|and|um|uh)\s+)+/;

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(FILLER, "")
    .replace(/\s+(?:please|now|thanks|thank you|for me)$/g, "")
    .trim();

// Start checkout: "place order", "place my order", "checkout", "I'd like to order", "that's all"
const CHECKOUT = new RegExp(
  "^(?:" +
    [
      "(?:place|submit|make|complete|finish|finalize|finalise|confirm|send)(?: (?:my|the|this|an|our))? order",
      "check ?out",
      "(?:proceed|go) to check ?out",
      "order(?: now)?",
      "(?:i want to|i wanna|i would like to|i'd like to|let's|lets|i'm ready to|i am ready to|ready to) (?:place(?: (?:my|the|an|our))? order|order|check ?out|pay)",
      "(?:that's|that is|thats) (?:all|it|everything)",
      "(?:i'm|i am) (?:done|finished|ready)",
      "(?:that will be|that'll be) all",
      "bill",
      "pay",
    ].join("|") +
    ")$",
);

// After the read-back: "yes", "confirm", "place the order" ...
const CONFIRM = new RegExp(
  "^(?:" +
    [
      // Explicit words only: a casual "okay" / "sounds good" must never place an order.
      "yes(?: (?:place|confirm|go ahead|do it|that's right|it is|correct))?(?: (?:the|my))?(?: order)?",
      "yeah|yep|yup|correct|confirm(?:ed)?|go ahead|do it|that's right|that is right|that's correct",
      "(?:place|confirm|submit|send|complete)(?: (?:my|the|this|our))? order",
      "yes (?:place|confirm|submit)(?: (?:my|the|this|our))? order",
    ].join("|") +
    ")$",
);

// After the read-back: "no", "change something", "cancel"
const CHANGE = /^(?:no|nope|nah|cancel|wait|hold on|not yet|stop|change(?: (?:it|something|the order|my order))?|no change|(?:i want to|i'd like to|i would like to|let me) change(?: (?:it|something|the order|my order))?|add (?:something|more)|something else)$/;

export function interpretCommand(text: string, ctx: { awaitingConfirm: boolean }): OrderCommand {
  const t = norm(text);
  if (!t || t.length > 60) return null;
  if (ctx.awaitingConfirm) {
    if (CHANGE.test(t)) return "change";
    if (CONFIRM.test(t)) return "confirm";
    // "checkout" / "that's all" again after the read-back: show the read-back again rather than assume consent.
    if (CHECKOUT.test(t)) return "checkout";
    return null;
  }
  if (CHECKOUT.test(t)) return "checkout";
  return null;
}
