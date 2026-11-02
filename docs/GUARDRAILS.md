# Guardrails

Each guardrail lists **where it is enforced** (prompt vs code) and **how it is tested**. The rule of thumb: if it matters, it is in code; the prompt only shapes behaviour.

| # | Guardrail | Enforced in code | Prompt | Tested by |
|---|---|---|---|---|
| 1 | Grounding | `lib/tools.ts` (only source of menu data), `lib/guardrails.ts#checkGrounding` | "never invent" | `scripts/check-guardrails.ts`, eval *grounding rate* |
| 2 | Confirm-before-order | `lib/tools.ts#placeOrderTool`, `lib/cart.ts#userConfirm`, `PUT /api/chat` (UI button) | read-back rules | `scripts/check-tools.ts`, eval *order safety* |
| 3 | Honest "no" | tools return empty results for unknown dishes | "say so + alternatives" | eval *honest-no* cases |
| 4 | Scope limit | `lib/guardrails.ts#checkUserInput` (pre-model gate) | scope section | eval *off-topic* cases |
| 5 | Deterministic math | `lib/cart.ts#viewCart` | "never calculate" | eval *cart/total correctness* |
| 6 | Input validation | Zod schemas on every tool; caps on length/qty/steps | — | `scripts/check-tools.ts` |

## 1. Grounding
- The model has no menu in its prompt; the only way to learn dishes/prices is `search_menu`, which reads `lib/menu.json`.
- After each reply, `checkGrounding` flags (a) any `₹` amount not in the menu or in this conversation's tool results, and (b) any Title-Case **bold** phrase that is not a menu item, category or known label.
- In the API route a failed check is **logged** (`[grounding] flagged reply`); the evals count it as a hallucination. *Limitation:* tokens are already streamed to the user, so this is detection, not prevention. Next step: buffer-and-verify for high-risk replies.

## 2. Confirm-before-order
`place_order` refuses unless **all** hold:
1. `confirmed: true` is passed;
2. the cart is non-empty; **and**
3. the customer pressed the **"Yes, place order" button** for the *current* cart. The button calls `PUT /api/chat`, which records consent server-side (`lib/cart.ts#userConfirm`). It shares the chat route on purpose: on Vercel each route is a separate serverless function with separate memory, and the in-memory session lives with the chat route (a first version used its own `/api/confirm` route and always saw an empty cart in production). It is not a model tool, so no model can confirm on the customer's behalf. Any cart change afterwards invalidates it.

Why a button and not "the model saw a yes": evals and a live test showed that weaker (free) models treat "place my order" or even their own earlier read-back as consent, and `confirmed: true` is just a flag the model sets. Consent now has to come from a real click. Consequence: typing "yes" is not enough — the waiter tells the customer to tap the button. Refusal messages are written for the model so it recovers gracefully.

History: a first version only required a `get_cart` read-back in an earlier turn; that was found too weak (an order was placed after only a Checkout click).

### Button-driven ordering is deterministic
*Add to cart*, *Checkout* and *Yes, place order* send fixed messages that the chat route recognises (`lib/orderFlow.ts`) and answers with code — the same guarded tool functions, not the model. Totals are computed by code, the read-back lists every line, and `place_order` still refuses without the server-recorded button press. Free-text requests ("place my order", "yes") still go to the model and still cannot place an order without the button.

### Ordering requires an account
`place_order` is **deny-by-default**: it refuses unless the caller passes `signedIn: true`, which the chat route derives from the verified session cookie — never from anything the browser or the model sends. The same check covers the deterministic buttons, the AI's `place_order` tool and the confirm-button endpoint (`PUT /api/chat` returns 401 to guests). Guests can still browse and fill a cart; the server keeps it, so signing in in the same tab continues where they left off.

### Feedback and invoices
Both are tied to the signed-in account: the user id comes from the verified session cookie, and the order id must exist on **that** account — someone else's order is a 404 and nothing changes. Ratings are whole numbers 1–5, comments are capped at 500 characters with control characters removed and are only ever rendered as plain text. Feedback is rate-limited per account. Invoice ids are validated (no path tricks), responses are `private, no-store`, and PDF text is sanitised for the standard fonts (unsupported characters become `?`). Invoices never invent tax identifiers and say they are demonstration documents.

### Cancel and refund
The AI has **no** cancel or refund tool. A cancel request in chat ("cancel my order", "I want a refund") is recognised by strict code matching and only produces an explanation plus a two-tap button; the cancellation itself is `POST /api/orders/cancel`, which needs a signed-in session, only finds orders on **that** account (someone else's id is a 404), is rate-limited, and works only within the cancellation window (default 10 minutes, `CANCEL_WINDOW_MINUTES`). The refund is always the full order total, computed from the stored order — never from client or model input — and the check-and-set runs inside the store's atomic update, so double-clicks or two tabs produce exactly one cancellation and one refund. No payment is taken in this demo, so the refund is a recorded entry (ref `RF-<order number>`), shown in the account, the chat card and the invoice (stamped CANCELLED).

### Group orders and split bill
Money maths is code, and the browser is never trusted for amounts. `POST /api/orders/split` takes only **who** shares **what** (names, and which people share each dish); every rupee is recomputed from the order stored on the signed-in customer's account (`lib/split.ts`). Rules: 2–12 distinct names (control characters stripped, 30 characters max), valid person indices, shares always add up to the order total exactly (the odd rupee is handed out in rotation), and a safety check refuses any result that doesn't. Own orders only (someone else's id is a 404), rate-limited, and the split is locked once anyone is marked paid so recorded payments can't be reshuffled. Cancelling an order clears its split. The AI has no tool for any of this.

### Accounts
Passwords are hashed with salted **scrypt** and compared in constant time; sign-in answers "Incorrect email or password" for both unknown email and wrong password (and does the same amount of work), so accounts can't be probed. Sessions are an HMAC-signed token in an `HttpOnly`, `SameSite=Lax` (and `Secure` in production) cookie that expires after 7 days. Sign-in and sign-up are rate-limited (8 attempts / 10 minutes per IP+email). Orders are saved to the account only after a turn succeeds, so a model failover/retry can never record an order twice.

## 3. Honest "no"
Searching for sushi/pizza/Chicken 65 returns zero items; the prompt requires saying so and offering 2–3 real alternatives found by search. `add_to_cart` with an unknown id fails. The eval asserts no successful add and no invented dish.

## 4. Scope
- Pre-model gate: regex for classic injection/jailbreak phrases ("ignore previous instructions", "reveal your prompt", "you are now…"), plus a 1000-char input cap → fixed polite decline, model never called.
- Prompt: decline anything off-topic in one sentence and steer back; cannot take payment, discount, or promise delivery times.
- *Limitation:* a regex gate is bypassable by paraphrase; the prompt rules are the second layer and the eval set contains jailbreak cases.

## 5. Deterministic math
Prices and totals live in `lib/cart.ts`. Tool results carry `lineTotal` and `total`; the prompt tells the model to quote, not compute. v1 violated this ("about ₹600"); the grounding check catches such numbers.

## 6. Input validation
Every tool has a Zod schema (`qty` 1–20 integer, enum categories, spice 0–3, etc.). Invalid input returns `{ok:false,error}` instead of throwing, so the model can recover. The route validates `sessionId` format and payload shape; history is capped at 30 messages; the agent loop at 8 steps.

## Allergen & dietary safety
The assistant states allergens only from `menu.json`. It does not guarantee cross-contamination safety and tells diners to confirm severe allergies with staff.

## Secrets
`ANTHROPIC_API_KEY` is read server-side only (`process.env`), lives in `.env.local` (gitignored) and Vercel env vars, and is never sent to the browser or logged.
