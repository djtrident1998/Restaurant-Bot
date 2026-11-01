# Guardrails

Each guardrail lists **where it is enforced** (prompt vs code) and **how it is tested**. The rule of thumb: if it matters, it is in code; the prompt only shapes behaviour.

| # | Guardrail | Enforced in code | Prompt | Tested by |
|---|---|---|---|---|
| 1 | Grounding | `lib/tools.ts` (only source of menu data), `lib/guardrails.ts#checkGrounding` | "never invent" | `scripts/check-guardrails.ts`, eval *grounding rate* |
| 2 | Confirm-before-order | `lib/tools.ts#placeOrderTool`, `lib/cart.ts` | read-back rules | `scripts/check-tools.ts`, eval *order safety* |
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
2. the cart is non-empty;
3. the customer has been shown the *current* cart via `get_cart` (cart version unchanged since), **and**
4. that read-back happened in an *earlier turn* than the one calling `place_order`.

(4) closes a loophole found during evals: the model could call `get_cart` and `place_order` in one turn, so the customer never saw the total. Refusal messages are written for the model ("call get_cart, read back, END your reply, wait for yes") so it recovers gracefully. Consequence: a message like "add dal makhani and place the order, I confirm" still gets a read-back first — by design.

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
