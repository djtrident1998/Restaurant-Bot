# Product discovery, guardrails and evals — explained with Spice Route

Three ideas that separate "I built a chatbot" from "I shipped an AI product". Each section says what it is, how it shows up in this project, and what is honestly missing.

## 1. Product discovery
**What it is:** the work done *before and during* building to make sure you are solving a real problem for real people. It answers four questions: who has the problem, how painful is it, would they use *this* solution, and will it work (technically, financially, legally). It is not a one-off step — you keep doing it after launch.

**Typical activities**
- Customer interviews and observation (what do people actually do today?)
- Defining the problem and the "job to be done" ("when I'm hungry and have a nut allergy, I want to know quickly what is safe")
- Assumption mapping: list what must be true, then test the riskiest assumptions first
- Cheap experiments: a prototype, a fake-door page, a Wizard-of-Oz test (a human behind the chat)
- Success metrics chosen up front

**In Spice Route**
- Problem and jobs-to-be-done are written in [PRD.md](PRD.md) (sections 1 and 3).
- Risky assumptions were identified and tested in the build: "a chatbot won't invent prices" (tested with evals), "people will trust it to order" (answered with a confirm button), "free AI models can carry a public launch" (tested — they can't, hence the cost framework).
- **Not done:** no interviews with diners or restaurant staff. The PRD says so openly and lists the next discovery steps in section 10. Saying this plainly is part of good discovery.

**Discovery vs delivery:** discovery decides *what* to build; delivery builds it. AI products need extra discovery because the model's behaviour is uncertain — you have to discover *failure modes* (what will it get wrong?), not just needs.

## 2. Guardrails
**What they are:** rules that keep an AI system inside safe, useful behaviour. The key idea: **a prompt is a request; code is a guarantee.** If something matters (money, safety, privacy), enforce it in code, and use the prompt only to shape tone and behaviour.

**Types**
- **Input guardrails:** screen what goes *in* (off-topic, prompt injection, too long, forged history)
- **Output guardrails:** check what comes *out* (does the answer contain a price that isn't on the menu?)
- **Action guardrails:** limit what the AI can *do* (it cannot place, cancel or refund an order)
- **Cost and abuse guardrails:** rate limits, budgets, size caps

**In Spice Route** (full table in [GUARDRAILS.md](GUARDRAILS.md))
| Risk | Guardrail | Where |
|---|---|---|
| Invented dishes or prices | Menu only reachable through a tool; grounding check on replies | code |
| Wrong totals or refunds | Computed by code, model only quotes them | code |
| Order placed without consent | Signed-in user + a button press recorded on the server | code |
| Cancel or refund abuse | Own orders only, 10-minute window, one refund per order; no AI tool for it | code |
| Off-topic or injection | Pre-model scope gate, sanitised history | code + prompt |
| Allergen liability | Answers only from allergen data, defers to staff | prompt + data |
| Surprise bill | Free-first models, daily cap on the paid one, rate limits, input caps | code |

**Honest limits:** the grounding check flags a bad reply after it is streamed (detect, not prevent); the scope gate's regex can be bypassed by paraphrase, so prompt and evals are the second layer.

**The lesson from this build:** weaker models treated a typed "yes" — even their own summary — as consent. The fix wasn't a better prompt; it was moving consent to a real button, enforced on the server.

## 3. Evals
**What they are:** automated tests for AI behaviour. Because model output varies, you can't just eyeball it. You write a set of labeled cases ("given this input, the right behaviour is X"), run the system on all of them, and score the results. They are the unit tests and regression tests of an AI product.

**What makes a good eval set**
- Cases covering normal use *and* failure modes (off-topic, ambiguous, adversarial)
- Clear pass/fail rules, ideally checked by code (did it call the right tool? did it show a price that isn't on the menu?) and sometimes by another model acting as a judge
- Run on every prompt or model change, so you see whether it got better or worse
- A held-out set you don't tune against, to avoid fooling yourself

**In Spice Route** (`npm run eval`, report in [EVAL_REPORT.md](EVAL_REPORT.md))
- 46 labeled cases across menu facts, dietary filters, cart maths, honest "no", off-topic, ambiguous requests and order confirmation.
- Metrics: tool-selection accuracy, grounding / hallucination rate, correct-decline rate, cart correctness, order safety.
- Prompt v1 (naive) vs v2 (tuned): hallucination 4.3% → 0%, correct decline 84.6% → 100%, order safety 66.7% → 100%.
- Evals found a real bug (the model read the cart from memory and the code guard rightly refused the order) and a weak guard (an order could be placed in the same turn as the read-back).
- **Honest limits:** one run, run on the Claude model used while building (the live app uses a free-first model chain), the cases are in the same repo they test (no held-out set), and tone isn't scored yet.
- Separate from evals, 397 offline code checks (`scripts/check-*.ts`) test the deterministic parts — totals, ordering rules, cancel and refund, limits — with no AI and no cost.

## How the three fit together
**Discovery** tells you what to build and what could go wrong. **Guardrails** make the dangerous failures impossible. **Evals** prove (and keep proving) that the system behaves as intended. Skip any one and an AI product tends to fail in a predictable way: built for no one, unsafe, or quietly getting worse.
