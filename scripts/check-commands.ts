import { interpretCommand, type OrderCommand } from "../lib/commands";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};
const cmd = (text: string, awaitingConfirm = false): OrderCommand => interpretCommand(text, { awaitingConfirm });

// ---- start checkout (cart not yet read back) ----
for (const t of [
  "place order", "Place order.", "place my order", "Place the order please", "checkout", "check out", "Check out!",
  "I'd like to place my order", "I want to order", "I would like to check out", "order now", "that's all", "That is all.",
  "I'm done", "please place my order", "okay place order", "ok checkout", "hey place my order now", "bill", "i am ready to order",
])
  check(`checkout: "${t}"`, cmd(t) === "checkout", String(cmd(t)));

// ---- ordinary talk must NOT trigger anything ----
for (const t of [
  "", "   ", "yes", "no", "hello", "what is on the menu", "is the order spicy", "I don't want to place an order",
  "don't place the order", "how long does an order take", "can you check out the starters for me", "show me the menu",
  "add two chana masala", "I'd like some water", "the bill seems wrong", "tell me about order tracking", "a".repeat(200),
])
  check(`ignored (not awaiting confirm): "${t.slice(0, 40)}"`, cmd(t) === null, String(cmd(t)));

// ---- after the read-back: explicit confirmation ----
for (const t of [
  "yes", "Yes.", "yes please", "yeah", "yep", "confirm", "confirmed", "go ahead", "yes place the order", "yes, confirm my order",
  "place order", "place the order", "confirm order", "yes confirm", "correct", "that's right", "do it", "okay yes", "yes place my order now",
])
  check(`confirm: "${t}"`, cmd(t, true) === "confirm", String(cmd(t, true)));

// ---- after the read-back: not a confirmation (must never place an order) ----
for (const t of [
  "okay", "ok", "sure", "sounds good", "looks good", "perfect", "hmm", "maybe", "what is the total", "is it spicy",
  "no don't place the order", "yes but add naan", "don't confirm", "not sure", "yes and no", "I said no",
])
  check(`NOT confirm: "${t}"`, cmd(t, true) !== "confirm", String(cmd(t, true)));

// ---- after the read-back: change / cancel ----
for (const t of ["no", "nope", "cancel", "wait", "hold on", "not yet", "change", "change something", "change my order", "I want to change something", "let me change it", "add something", "no change", "stop"])
  check(`change: "${t}"`, cmd(t, true) === "change", String(cmd(t, true)));

// ---- re-asking checkout after the read-back shows it again, never confirms ----
check('"checkout" again after the read-back re-reads the cart', cmd("checkout", true) === "checkout");
check('"that\'s all" after the read-back re-reads the cart, never confirms', cmd("that's all", true) === "checkout");

// ---- "yes" with no read-back on screen does nothing ----
check('"yes" when nothing is awaiting confirmation does nothing', cmd("yes", false) === null && cmd("confirm", false) === null && cmd("go ahead", false) === null);

process.exit(fails ? 1 : 0);
