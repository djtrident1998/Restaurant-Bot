# PRD — Spice Route AI Waiter

**Status:** MVP shipped · **Owner:** Product · **Model:** Claude via Vercel AI SDK (`MODEL_ID` env)

## 1. Problem
Diners at a North Indian restaurant ask the same questions repeatedly — what's vegetarian, what's mild, what's under ₹300, "do you have X?" — and staff time is spent answering instead of serving. Menu PDFs don't answer *questions*, and generic chatbots **invent dishes and prices**, which in a food-ordering context means wrong orders, allergen risk and refund disputes.

## 2. Goal
A conversational waiter that answers menu questions accurately, builds a cart, and places an order — with **trustworthiness as the product**, not just fluency.

### Success metrics (measured by `npm run eval`, 46 labeled cases)
| Metric | Target | v2 result |
|---|---|---|
| Hallucination rate (invented dish/price) | ≈ 0% | 0.0% |
| Correct-decline rate (off-topic + not-on-menu) | ≥ 95% | 100% |
| Cart/total correctness | 100% | 100% |
| Order safety (never place without confirmation) | 100% | 100% |
| Tool-selection accuracy | ≥ 95% | 100% |

Results vary run-to-run (see `EVAL_REPORT.md` caveats); the guarantees that matter are enforced in code, not by the score.

## 3. Users & key jobs
- **Diner with a dietary need** — "vegan under ₹300", "no nuts", "mild".
- **Hungry, decisive diner** — "add 2 paneer tikka and 3 naan, what's my total?"
- **Curious diner** — "what's your spiciest dish?", "do you have sushi?"

## 4. Scope
**In (MVP):** menu Q&A, dietary/price/spice filters, cart, order confirmation flow, mock order status, rich UI (menu cards, cart panel, order card), mobile-friendly.
**Out:** payments, real kitchen/POS integration, accounts, persistence (cart is in-memory), delivery tracking, multi-language, voice.

## 5. Principles (what makes this an AI-PM product)
1. **Ground every fact.** The menu is the only source of truth; the model can't state a dish/price that didn't come from a tool.
2. **Math is code.** Line totals and cart totals are computed by tool functions, never by the model.
3. **Irreversible actions need consent, enforced in code.** `place_order` refuses unless the customer confirmed *and* was shown the current cart in an earlier turn.
4. **Say no honestly.** Not on the menu → say so, offer real alternatives.
5. **Stay in scope.** Decline off-topic and prompt-injection politely.
6. **Measure, don't vibe.** Every prompt change is scored against the eval set.

See [GUARDRAILS.md](GUARDRAILS.md).

## 6. UX
Chat on the left; live cart on the right (toggled from the header on mobile). Search results render as menu cards with veg/non-veg marks, spice level and allergens; quick-start chips; "Add to cart" buttons; one-tap *Yes, place order* after the read-back; green order-confirmation card.

## 7. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Model invents dish/price | Tool-only grounding + post-reply grounding check + eval metric |
| Model miscalculates totals | Totals only from `add_to_cart`/`get_cart`; model must quote them |
| Accidental/unauthorised order | `place_order` gate in code (confirmed + read-back in earlier turn + non-empty cart) |
| Allergen advice liability | Answers only from allergen fields; refuses to guarantee cross-contamination; defers to staff |
| Prompt injection / jailbreak | Regex pre-gate before the model + scope rules in prompt; eval cases |
| Abuse / cost | Input length cap, step cap (8), history cap (30 messages) |
| Cart lost on cold start | Known and acceptable for demo; documented |

## 8. Findings from eval iteration (v1 → v2)
- Naive prompt (v1) answered off-topic questions (capital of France, wrote Python), invented a "₹600 total" from its own arithmetic, and tried to order without a read-back.
- v2 tightened grounding, math, ordering and scope rules → hallucination 4.3% → 0%, decline 84.6% → 100%.
- A real bug found by evals: the model read the cart back *from memory*, and the code guard (correctly) refused the order. Fixed with an explicit rule + actionable tool error.
- Another: the first guard accepted a `get_cart` and `place_order` in the **same turn**, so the customer never saw the read-back. Tightened to require an earlier turn.

## 9. Next
Persistence (KV/DB), payments sandbox, held-out eval set + LLM-as-judge for tone, streaming-time grounding enforcement (currently flag + log), allergen-severity escalation, analytics on declined intents.
