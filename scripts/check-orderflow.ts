// Offline: the whole button-driven order journey, exercised through the same functions the API route calls. No AI.
import { detectOrderIntent, handleOrderIntent } from "../lib/orderFlow";
import { addRequestText, CHECKOUT_TEXT, CONFIRM_TEXT } from "../lib/chatMessages";
import { userConfirm, viewCart, getOrders } from "../lib/cart";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};
const run = (sid: string, text: string) => {
  const intent = detectOrderIntent(text);
  return intent ? handleOrderIntent(sid, intent) : null;
};

const S = "flow-test-session";

// --- detection ---
check("add button text is recognised", detectOrderIntent(addRequestText("Chana Masala", 2))?.type === "add");
check("add is case-insensitive on the dish name", detectOrderIntent("add 1 paneer tikka to my cart")?.type === "add");
check("unknown dish falls through to the AI", detectOrderIntent("Add 1 Sushi Roll to my cart") === null);
check("free text is not intercepted", detectOrderIntent("Add some naan please") === null && detectOrderIntent("place my order") === null);
check("checkout / confirm texts recognised", detectOrderIntent(CHECKOUT_TEXT)?.type === "checkout" && detectOrderIntent(CONFIRM_TEXT)?.type === "confirm");

// --- empty cart ---
check("checkout on an empty cart says so", /empty/i.test(run(S, CHECKOUT_TEXT)!.text));
check("confirm on an empty cart places nothing", /empty/i.test(run(S, CONFIRM_TEXT)!.text) && getOrders(S).length === 0);

// --- adding ---
const a1 = run(S, addRequestText("Chana Masala", 2))!;
check("add 2 Chana Masala: line ₹440, total ₹440 (code math)", /₹440/.test(a1.text) && viewCart(S).total === 440, a1.text.split("\n")[0]);
const a2 = run(S, addRequestText("Tandoori Roti", 3))!;
check("add 3 Tandoori Roti: total ₹545", viewCart(S).total === 545 && /₹545/.test(a2.text));
check("quantity over the limit is refused by the tool", /Sorry/.test(run(S, "Add 21 Butter Naan to my cart")!.text) && viewCart(S).total === 545);

// --- checkout read-back ---
const co = run(S, CHECKOUT_TEXT)!;
check("checkout reads back every line and the exact total", /2 × Chana Masala — ₹440/.test(co.text) && /3 × Tandoori Roti — ₹105/.test(co.text) && /Total: ₹545/.test(co.text));
check("checkout asks the question the UI keys on", /place this order/i.test(co.text));
check("checkout does NOT place the order", getOrders(S).length === 0 && viewCart(S).total === 545);

// --- the confirm-button rule (typed 'yes' / model cannot confirm) ---
const typed = run(S, CONFIRM_TEXT)!;
check("'Yes, place the order' WITHOUT the button is refused", /tap the/i.test(typed.text) && getOrders(S).length === 0 && viewCart(S).total === 545);

// --- button press, then order ---
check("button press accepted for a non-empty cart", userConfirm(S));
const placed = run(S, CONFIRM_TEXT)!;
const order = getOrders(S)[0];
check("order placed after the button press", /SR-\d{4}/.test(placed.text) && getOrders(S).length === 1 && order?.cart.total === 545);
check("order card output is attached for the UI", placed.outputs[0]?.toolName === "place_order" && (placed.outputs[0].output as { ok?: boolean }).ok === true);
check("cart emptied after the order", viewCart(S).total === 0);
check("second 'yes' cannot place the same order again", getOrders(S).length === 1 && !/SR-\d{4}/.test(run(S, CONFIRM_TEXT)!.text));

// --- stale confirmation: cart changes after the button press ---
const T = "flow-test-stale";
run(T, addRequestText("Butter Naan", 1));
userConfirm(T);
run(T, addRequestText("Mango Lassi", 1)); // cart changed AFTER consent
check("consent is voided when the cart changes", /tap the/i.test(run(T, CONFIRM_TEXT)!.text) && getOrders(T).length === 0);

// --- sessions are isolated ---
check("another session's cart is untouched", viewCart("flow-test-other").total === 0);

process.exit(fails ? 1 : 0);
