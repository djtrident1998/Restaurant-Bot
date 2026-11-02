# 🌶 Spice Route — AI Waiter

A restaurant AI assistant for a North Indian kitchen: ask about the menu, filter by diet/price/spice, build a cart, confirm and place an order. Built to show **AI product rigor** — a PRD, enforced guardrails, and a measured eval suite — not just a chatbot.

- **Created by [Dibyajyoti Ray](https://github.com/djtrident1998)** — designed, built and tested as an AI product management project. See the in-app [About page](https://restaurant-bot-three.vercel.app/about).
- **Live demo:** _(added after deploy)_
- **Docs:** [PRD](docs/PRD.md) · [Guardrails](docs/GUARDRAILS.md) · [Eval report](docs/EVAL_REPORT.md)

## Headline result
On a 46-case labeled eval, tuning the prompt (v1 → v2) took **hallucination from 4.3% → 0%**, correct-decline from **84.6% → 100%**, and order safety from **66.7% → 100%** (single run; see caveats in the report). The rules that matter — grounding, confirm-before-order, deterministic totals — are enforced **in code**, not just in the prompt.

## Features
- **Luxury landing page** with a hero photo of the dining room, signature dishes and an "order now" call to action.
- **Course-by-course menu:** ask for the menu and the waiter asks *Starters, Main Course, Breads & Rice, Desserts or Drinks?* — each course shows dishes with photos, prices, diet marks and allergens. Built straight from the menu data, so it is instant and uses no AI.
- **Accounts, required to order:** guests can browse and fill a cart, but checking out asks them to sign in or create an account first (their cart is kept). Email + password, salted scrypt hashes, signed HttpOnly session cookie. Returning customers are greeted by name, see their last order in the ordering room, and the full history under *Account*.
- **Feedback and ratings:** right after an order, rate your meal 1–5 stars with an optional comment; it is saved to your account and can be edited later from the Account page. You can only rate your own orders.
- **Allergen Shield (differentiator):** save your food profile once (vegetarian only, avoid nuts / dairy / gluten / fish / egg). Every dish card is flagged ("⚠ contains nuts" or "✓ fits your profile"), adding a conflicting dish gets a warning from code, and the AI waiter is told what to avoid. See `docs/GUARDRAILS.md`.
- **Your data, your control:** privacy policy and terms pages, a consent line at sign-up, download-my-data (JSON) and password-confirmed account deletion.
- **Cart editing:** +/− and remove on every cart line (deterministic, no AI), plus instant "Added ✓" feedback on dishes.
- **Global-standard basics:** WCAG-checked colour contrast, keyboard focus and skip link, share preview image + metadata + sitemap + robots, security headers with a CSP, `/api/health`, friendly error pages. The full checklist, including what is still missing, is in [docs/GLOBAL_STANDARD.md](docs/GLOBAL_STANDARD.md).
- **Food-app look:** bright, rounded, food-first UI — round category tiles, dish rows with photo, quantity stepper and ADD button, a live cart with "To pay", and a dark photo hero on the landing page.
- **Different layouts for laptop and phone:** on a laptop the ordering screen has three columns — a menu/quick-question sidebar, the chat with a wide dish grid, and the cart panel. Phones and tablets get the app-style single column with category tiles, quick chips and a cart button that opens a bottom sheet.
- **Built for phones:** at phone width the cart is a bottom sheet (Close / tap outside), dish rows and the split editor fit without sideways scrolling, tap targets are at least 36–40px, inputs use 16px text (no iOS zoom), content respects notches/safe areas, and the browser bar takes the brand colour.
- **Group orders and split bill:** after ordering, divide the bill between 2–12 people equally or dish by dish, then tick who has paid and copy a summary to share. All amounts are computed by code from the saved order (the browser only says who shares what), always add up to the rupee, and lock once someone is marked paid. No real payment is taken, so "paid" is a note for the host. Use the quantity stepper on each dish to order in bulk (up to 20 per dish).
- **Cancel and refund:** cancel an order within 10 minutes of placing it (`CANCEL_WINDOW_MINUTES`) from the confirmation card, the Account page, or by saying/typing "cancel my order" (two taps to confirm). The full total is refunded as a recorded entry — this demo takes no real payment, so no money moves — and the invoice is stamped CANCELLED. Handled entirely by code (no AI tokens); see `docs/GUARDRAILS.md`.
- **PDF invoices:** download an invoice for any of your orders from the confirmation card or the Account page (`/api/invoice/<order id>`, sign-in required, your own orders only). Optional `INVOICE_BUSINESS_NAME`, `INVOICE_ADDRESS` and `INVOICE_TAX_ID` env vars add business details; nothing is invented, and the invoice states it is a demonstration document, not a tax invoice. The PDF shows amounts as "Rs." because the standard PDF fonts have no ₹ glyph.
- **Voice questions:** tap the microphone in the chat box and just say what you'd like — your words appear as you speak and are sent when you finish. Uses the browser's built-in speech recognition (Chrome, Edge, Safari): free, no API key, nothing stored by us. You can also order by voice (or by typing): "place order" starts checkout, and after the read-back "yes" / "confirm" places the order while "no" / "change something" goes back — the same as the buttons, with strict matching so casual words like "okay" never place an order. In Chrome the browser sends the audio to Google's speech service to transcribe it; a short notice appears if the microphone is blocked or the browser doesn't support it (Firefox), and typing always works.
- **Button-driven ordering without the AI:** *Add to cart*, *Checkout* and *Yes, place order* are handled by code (same guarded tools), so they are instant and keep working when every AI model is rate-limited. The AI handles free-form questions.

## Stack
Next.js (App Router) · TypeScript · Tailwind · Vercel AI SDK (`ai`, `@ai-sdk/anthropic`, `@ai-sdk/react`) · Zod · `tsx` for evals. No database: the menu is JSON, the cart is in-memory per session.

## Run locally
```bash
npm install
cp .env.example .env.local   # then fill in your key
npm run dev                  # http://localhost:3000
```
`.env.local` — an ordered chain of models with automatic failover:
```
MODEL_CHAIN=groq:openai/gpt-oss-120b,groq:openai/gpt-oss-20b,google:gemini-3.5-flash,anthropic:claude-haiku-5-5
GROQ_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
ANTHROPIC_API_KEY=...
```
Free models go first, paid Haiku last. If a model fails before answering (rate limit, no credits, outage) the next one is used invisibly and the failed one is skipped for 2–10 minutes, then tried first again — so traffic returns to the free tiers as soon as they refresh. Providers with no key are skipped. Single model instead: `MODEL_PROVIDER` + `MODEL_ID`. Public demo caps: 40 messages/visitor/day, 300/day overall. Keys are read server-side only and `.env*` is gitignored. See [free model notes](docs/FREE_MODEL_NOTES.md).

## Accounts and storage
Accounts are stored in **Vercel Blob (private)** in production: create a Blob store in the Vercel dashboard (Storage tab) and connect it to the project — that adds `BLOB_READ_WRITE_TOKEN` automatically. Without it, accounts fall back to server memory (a notice is shown on the sign-up page) and are lost on restart. Locally they go to `.data/users.json` (git-ignored). Optionally set `SESSION_SECRET`; otherwise it is derived from the Blob token.

## Cost & traffic safety
Built to survive a viral post: static landing page, no-AI ordering paths, free-first model chain, a shared daily budget on the paid model, per-visitor/global limits, input/history caps and `[usage]` logging. Details, tunable `LIMIT_*` variables and a runbook: [docs/COST_FRAMEWORK.md](docs/COST_FRAMEWORK.md).

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run eval` | Runs all 46 cases for prompt v1 and v2 → console scorecard, `evals/results.json`, `docs/EVAL_REPORT.md` |
| `npx tsx evals/run.ts --version=v2` | Run one prompt version only (`--version=report` rebuilds the report from stored results) |
| `npx tsx scripts/check-*.ts` | Offline checks (no API key, no AI calls): menu, tools, guardrails, failover, model views, course picker, accounts, order flow, voice, spoken/typed order commands, feedback, invoice |

## How it works
```
Browser (chat + cart) → POST /api/chat → input gate → Claude (tools + system prompt)
                                          ├ search_menu · add_to_cart · get_cart
                                          └ place_order (needs the customer's button press, PUT /api/chat) · order_status
                         → streamed reply + tool results → menu cards / cart / order card
```
`lib/agent.ts` is shared by the API route and the eval runner, so evals test real behaviour.

## Project layout
`app/` route + page · `components/` UI · `lib/` menu, cart, tools, prompt, guardrails, agent · `evals/` test set + runner · `docs/` PRD, guardrails, eval report.

## Known limitations
- The cart and orders are **in-memory** and reset on server restart/cold start (Vercel serverless can also route requests to different instances). Fine for a demo; production needs a store (KV/DB).
- Grounding violations are detected and logged after streaming, not blocked mid-stream.
- The scope gate's regex is bypassable by paraphrase; the prompt and evals are the second layer.
- Order status is mocked from elapsed time; there is no payment or kitchen integration.
- Eval results vary slightly run to run; the test set was also used to tune the prompt.
