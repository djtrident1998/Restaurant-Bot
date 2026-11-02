# LinkedIn post — Spice Route AI Waiter

Copy the post below as is. LinkedIn doesn't render Markdown, so the plain line breaks are intentional.

---

**POST**

I built an AI waiter for a restaurant. The hard part wasn't making it talk — it was making it trustworthy.

Meet Spice Route: you ask for "something mild without nuts" or "vegan under ₹300", and it answers from the real menu, builds your order and checks you out. In voice or text.

Try it: https://restaurant-bot-three.vercel.app

Generic chatbots invent dishes and prices. In food ordering that means wrong orders, allergen risk and refund disputes. So I treated trust as the product:

→ Grounded: the model has no menu in its head. Every dish and price comes from a tool call.
→ Math is code: totals and refunds are computed by code, never by the AI.
→ Consent in code: an order is placed only after a signed-in customer taps the confirm button. The AI can't place, cancel or refund anything.
→ Honest "no": if it's not on the menu, it says so and suggests real dishes.

I measured it, not just vibed it. A 46-case eval suite took the hallucination rate from 4.3% to 0%, correct refusals from 84.6% to 100%, and order safety from 66.7% to 100% (single run; details in the repo).

Two lessons that surprised me:
1. "Yes" typed in chat isn't consent. Cheaper models treated even their own summary as a go-ahead. I moved consent to a real button press, enforced on the server.
2. Free models can't carry a public launch. So I added a failover chain (free models first, paid last), a hard daily cap on the paid one, and made routine steps — menu, cart, checkout, cancel — run with zero AI calls.

The feature I'm proudest of: Allergen Shield. Tell it once that you avoid nuts or eat vegetarian, and every dish is flagged, adding a conflicting dish gets a warning from code, and the AI is told what to avoid. Safety shouldn't depend on the model remembering.

Also shipped: accounts and order history, group orders with bill splitting, ratings, PDF invoices, cancel-with-refund, and one-click download or deletion of your data.

Honest limits: no real payments (refunds are recorded, not transferred), and my problem statement comes from research, not diner interviews yet. Next step is talking to real diners and restaurant owners.

PRD, guardrails and the eval report are all in the repo: https://github.com/djtrident1998/Restaurant-Bot
More about the project and me: https://restaurant-bot-three.vercel.app/about

What would you want an AI waiter to never do on its own?

#ProductManagement #AIProductManagement #GenerativeAI #LLM #Evals #AIGuardrails #BuildInPublic

---

**Posting tips**
- **Image:** attach a screenshot of the menu cards plus a short screen recording of ordering by voice. Posts with a visual get more attention than text alone.
- **Links:** LinkedIn can reduce reach for posts with links. Put the demo link in the post as above, or move both links to the **first comment** and write "link in comments" in the post.
- **Timing:** post on a weekday morning and answer comments in the first hour.
- **Before you post:** set a monthly spend limit in the Anthropic Console, and sign in once on the live site to check it works.
- **Numbers:** the eval figures are from one run, on the Claude model used while building. The live app runs a different model chain (free models first), so say "in my eval" rather than "the live app scores".
