import { searchMenuTool, addToCartTool, getCartTool, placeOrderTool, orderStatusTool, modelViewSearch, modelViewCart, modelViewOrder } from "../lib/tools";
import { beginTurn, userConfirm } from "../lib/cart";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};
const S = "test-session";
beginTurn(S);

const s1 = searchMenuTool({ query: "paneer", filters: { veg: true } });
check("search paneer", s1.ok && s1.items.length >= 3);
check("search bad args", !searchMenuTool({ filters: { maxSpice: 9 } }).ok);
check("search bad category", !searchMenuTool({ query: "x", filters: { category: "Pizza" } }).ok);

check("add unknown item fails", !addToCartTool(S, { itemId: "zz-99", qty: 1 }).ok);
check("add qty 0 fails", !addToCartTool(S, { itemId: "st-01", qty: 0 }).ok);
check("add qty 'two' fails", !addToCartTool(S, { itemId: "st-01", qty: "two" }).ok);
check("add qty 21 fails", !addToCartTool(S, { itemId: "st-01", qty: 21 }).ok);

const a = addToCartTool(S, { itemId: "st-01", qty: 2 }); // 2 x 280
check("line total 560", a.ok && a.line.lineTotal === 560);
const b = addToCartTool(S, { itemId: "br-01", qty: 3 }); // 3 x 60
check("cart total 740", b.ok && b.cart.total === 740 && b.cart.itemCount === 5);
const c = addToCartTool(S, { itemId: "br-01", qty: 1 }); // merges -> 4 x 60
check("lines merge", c.ok && c.cart.lines.length === 2 && c.cart.total === 800);

check("unconfirmed order refused", !placeOrderTool(S, { confirmed: false }).ok);
check("missing confirmed arg refused", !placeOrderTool(S, {}).ok);
check("confirmed:true without button press refused", !placeOrderTool(S, { confirmed: true }).ok);
const g = getCartTool(S);
check("get_cart total 800", g.ok && g.cart.total === 800);
beginTurn(S);
check("model read-back + typed yes (no button) refused", !placeOrderTool(S, { confirmed: true }).ok);
check("button on empty cart rejected", !userConfirm("empty-session"));
check("button press accepted", userConfirm(S));
addToCartTool(S, { itemId: "bv-02", qty: 1 }); // cart changed AFTER the button press
check("stale button press refused (cart changed)", !placeOrderTool(S, { confirmed: true }).ok);
beginTurn(S);
userConfirm(S); // customer presses the button for the new cart
const o = placeOrderTool(S, { confirmed: true });
check("confirmed order placed", o.ok && o.cart.total === 870 && /^SR-\d{4}$/.test(o.orderId), o.ok ? o.orderId : "");
check("cart emptied after order", getCartTool(S).ok && (getCartTool(S) as any).cart.total === 0);
beginTurn(S);
check("empty cart order refused",!placeOrderTool(S, { confirmed: true }).ok);
check("order status", o.ok && (orderStatusTool(S, { orderId: o.orderId }) as any).status === "Received");
check("unknown order status fails", !orderStatusTool(S, { orderId: "SR-0000" }).ok);
check("sessions isolated", (getCartTool("other") as any).cart.total === 0);

// ---- compact model-facing views: smaller, but must still carry every fact the model needs ----
const sv = modelViewSearch(searchMenuTool({ query: "paneer tikka" }) as never);
check("model view: search has id, exact price, diet, allergens", /st-01\|Paneer Tikka\|₹280\|veg\|spice2\|Starters\|allergens:dairy/.test(sv), sv.split("\n")[1]);
check("model view: search omits long descriptions", !sv.includes("marinated"));
const big = modelViewSearch(searchMenuTool({ query: "", filters: {} }) as never);
check("model view: capped at 8 items + 'more' note", big.split("\n").filter((l) => /^[a-z]{2}-\d\d\|/.test(l)).length === 8 && /\+\d+ more/.test(big));
const none = modelViewSearch(searchMenuTool({ query: "sushi" }) as never);
check("model view: no-match lists real alternatives only", /suggest ONLY/.test(none) && /st-01\|Paneer Tikka\|₹280/.test(none));
check("model view: vegan flagged", /Chana Masala\|₹220\|vegan/.test(modelViewSearch(searchMenuTool({ query: "chana masala" }) as never)));
check("model view: error surfaced", /^Error:/.test(modelViewSearch(searchMenuTool({ filters: { maxSpice: 9 } }) as never)));
const cv = modelViewCart({ ok: true, cart: { lines: [{ qty: 2, name: "Paneer Tikka", unitPrice: 280, lineTotal: 560 }], itemCount: 2, total: 560 } });
check("model view: cart has line math and TOTAL", /2x Paneer Tikka @₹280=₹560; TOTAL ₹560/.test(cv), cv);
check("model view: empty cart", /cart empty; TOTAL ₹0/.test(modelViewCart({ ok: true, cart: { lines: [], itemCount: 0, total: 0 } })));
check("model view: refused order shows error text", /^Error: Order NOT placed/.test(modelViewOrder(placeOrderTool("view-test", { confirmed: true }) as never)));
check("UI output still has full descriptions", (searchMenuTool({ query: "paneer tikka" }) as { items: { description: string }[] }).items[0].description.length > 20);

process.exit(fails ? 1 : 0);
