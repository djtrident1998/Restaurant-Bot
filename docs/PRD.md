# PRD — Spice Route AI Waiter

**Status:** Live (v1.0) · **Owner:** Product · **Live demo:** https://restaurant-bot-three.vercel.app · **Code:** https://github.com/djtrident1998/Restaurant-Bot
**Stack:** Next.js, Vercel AI SDK, model chain Groq → Gemini → Claude Haiku (set by `MODEL_CHAIN`), Vercel Blob for accounts

## 1. Problem
Diners at a North Indian restaurant ask the same questions repeatedly — what's vegetarian, what's mild, what's under ₹300, "do you have X?" — and staff time goes to answering instead of serving. Menu PDFs don't answer *questions*, and generic chatbots **invent dishes and prices**, which in food ordering means wrong orders, allergen risk and refund disputes.

> **Discovery status (honest):** this problem statement comes from desk research and my own knowledge of how restaurant ordering works, **not** from interviews with real diners or restaurant staff. Section 10 lists what must be validated before treating it as proven.

## 2. Goal
A conversational waiter that answers menu questions accurately, builds a cart, and places an order — with **trustworthiness as the product**, not just fluency — and that stays affordable when a public audience finds it.

### Success metrics
**Quality** (measured by `npm run eval`, 46 labeled cases; single run, see `EVAL_REPORT.md` caveats)

| Metric | Target | Baseline prompt (v1) | Tuned prompt (v2) |
|---|---|---|---|
| Hallucination rate (invented dish/price) | ≈ 0% | 4.3% | 0.0% |
| Correct-decline rate (off-topic + not-on-menu) | ≥ 95% | 84.6% | 100% |
| Cart/total correctness | 100% | 100% | 100% |
| Order safety (never place without confirmation) | 100% | 66.7% | 100% |
| Tool-selection accuracy | ≥ 95% | 96.7% | 100% |

The guarantees that matter are enforced in code, not by the score (section 5).

**Cost & reliability** (monitored from the `[usage]` log lines and Vercel logs)
- Paid-model calls per day ≤ the shared daily budget (default 60).
- Share of questions answered without any AI call (menu, course picker, cart, checkout, cancel) — should stay high.
- Chat availability: a visitor always gets a reply, even if every AI provider is rate-limited.

**Engagement** (not yet instrumented — next step): sign-ups, orders placed, orders cancelled, average rating.

## 3. Users & key jobs
- **Diner with a dietary need** — "vegan under ₹300", "no nuts", "mild".
- **Hungry, decisive diner** — "add 2 paneer tikka and 3 naan, what's my total?"
- **Curious diner** — "what's your spiciest dish?", "do you have sushi?"
- **Returning customer** — "what did I order last time?", rate an order, download an invoice.
- **Customer who changed their mind** — "cancel my order".

## 4. Scope
**In (shipped):**
- Menu Q&A with dietary / price / spice filters; course-by-course menu with dish photos
- Cart, checkout read-back and an explicit *Yes, place order* button
- Accounts (email + password); **ordering requires sign-in**; order history for returning customers
- Voice input (microphone) and spoken/typed commands such as "place order"
- Feedback and 1–5 star ratings after an order
- PDF invoices
- **Group orders:** quantity stepper for bulk quantities (up to 20 per dish) and a bill split between 2–12 people, equally or dish by dish, with a "paid" tracker (no real payment)
- **Cancel and refund** within a 10-minute window (full refund recorded)
- Food-delivery-style UI: category tiles, dish rows with photos, live cart
- Luxury landing page and responsive UI
- Cost and traffic protection for a public launch (section 6)

**Out:** real payments and refunds (the refund is a recorded entry), real kitchen/POS integration, delivery tracking, multi-language, email verification, password reset, a persistent cart (the cart is in-memory), per-user analytics.

## 5. Principles and guardrails (what makes this an AI-PM product)
1. **Ground every fact.** The menu is the only source of truth; the model can't state a dish or price that didn't come from a tool.
2. **Math is code.** Line totals, cart totals and refunds are computed by code, never by the model.
3. **Irreversible actions need consent, enforced in code.** `place_order` refuses unless a signed-in customer pressed the confirm button for the current cart. The model cannot place, cancel or refund an order.
4. **Say no honestly.** Not on the menu → say so, offer real alternatives.
5. **Stay in scope.** Decline off-topic requests and prompt injection politely.
6. **Measure, don't vibe.** Every prompt change is scored against the eval set.
7. **Spend is a product requirement.** Free models first, a hard daily cap on the paid one, and no-AI paths for everything routine.

Details, with where each is enforced and how it is tested: [GUARDRAILS.md](GUARDRAILS.md).

## 6. Cost and traffic framework
Layers, cheapest first: static landing page → no-AI paths (menu, cart, checkout, cancel, order commands) → free-first model chain with failover → shared daily budget on the paid model → per-visitor and global rate limits → input/body/history caps → compact prompts and tool results → `[usage]` logging. Tunable with `LIMIT_*` env vars. See [COST_FRAMEWORK.md](COST_FRAMEWORK.md).

## 7. UX
Chat on the left; live cart on the right (toggled from the header on mobile). Search results render as menu cards with photos, veg/non-veg marks, spice level and allergens; course buttons; "Add to cart"; a read-back, then one-tap *Yes, place order*; an order card with invoice, a two-tap *Cancel order & refund*, and a rating form. Plain-language messages when the AI is busy ("menu, cart and ordering buttons still work").

## 8. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Model invents dish/price | Tool-only grounding + post-reply grounding check + eval metric |
| Model miscalculates totals or refunds | Totals and refunds only from code; the model must quote them |
| Accidental or unauthorised order | `place_order` gate in code (signed in + button press for the current cart + non-empty cart) |
| Unauthorised or duplicate cancel/refund | Own orders only, 10-minute window, atomic update so two clicks give one refund; the AI has no such tool |
| Allergen advice liability | Answers only from allergen fields; won't guarantee cross-contamination; defers to staff |
| Prompt injection / jailbreak | Pre-model gate, scope rules, history sanitiser (text only, forged system/tool messages dropped), eval cases |
| Surprise bill after a viral post | Free-first chain, shared daily cap on the paid model, rate limits, a provider-side spend limit |
| Free-tier quotas run out | Failover, cooldowns, no-AI paths, friendly "capacity reached" message |
| Account data exposure | Private Blob store, scrypt password hashes, signed HttpOnly session cookie, secrets stored as Sensitive |
| Cart lost on cold start | Known and accepted for the demo |

## 9. Findings from iteration
- **Evals (v1 → v2):** the naive prompt answered off-topic questions, invented a "₹600 total" from its own arithmetic and tried to order without a read-back. Tightening grounding, math, ordering and scope rules took hallucination 4.3% → 0% and order safety 66.7% → 100%.
- **A real bug found by evals:** the model read the cart back from memory and the code guard (correctly) refused the order. Fixed with an explicit rule and an actionable tool error.
- **Consent had to be a click, not a "yes":** weaker free models treated "place my order" or their own read-back as consent, and an order was placed after only a Checkout click. Consent is now a server-recorded button press.
- **Free tiers are small:** Groq's free tier (~200k tokens/day) and Gemini's (~20 requests/day) can't carry a public demo alone, hence the failover chain, the no-AI paths and the paid-model cap.
- **Vercel runs each route as a separate function:** a separate confirm route saw an empty cart in production, so confirmation lives in the chat route.

## 10. Discovery gaps — what to validate next
1. Interview 5–8 diners and 2–3 restaurant owners or staff: which questions really repeat, and would they order through chat rather than a menu?
2. Check whether voice ordering is actually used, or just a demo feature.
3. Test the cancellation window (10 minutes) against how a real kitchen works.
4. Instrument the funnel: visit → chat → add to cart → sign-up → order → rating.
5. Review real transcripts for declined or failed questions and add them to the eval set.

## 11. Next
Real payments sandbox and refunds, persistent cart and order store, password change/reset and email verification, held-out eval set with LLM-as-judge for tone, streaming-time grounding enforcement (currently flag and log), allergen-severity escalation, analytics.
