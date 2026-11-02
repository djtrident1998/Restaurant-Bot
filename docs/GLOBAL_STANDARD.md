# Global standard checklist and differentiation

An honest view of where Spice Route stands against what users, regulators and reviewers expect from a consumer product anywhere in the world. "Met" means built and tested here; "Partly" means a sensible base exists; "Not yet" is a real gap.

## What makes it different
| | Typical delivery apps (Swiggy, Zomato) | Generic AI chatbot | **Spice Route** |
|---|---|---|---|
| Finds dishes | Search and filters | Free text, may invent dishes | Free text **grounded in the real menu** (every dish and price comes from a tool) |
| Totals, refunds, splits | Server code | Often computed by the model, sometimes wrong | **Always code**, never the AI; shares add up to the rupee |
| Orders | Tap to buy | Can be talked into actions | The AI **cannot** place, cancel or refund; consent is a server-recorded button press |
| Allergies | A veg/non-veg switch, allergen text in details | None | **Allergen Shield**: save once; every dish flagged, add-to-cart warned, AI told, all enforced in code |
| Cost safety | n/a | Open-ended spend | Free-first models, shared daily cap on the paid one, no-AI paths for routine steps |
| Proof | Not public | None | Public eval suite (46 cases), 500+ offline checks, written guardrails |
| Your data | Account settings | Varies | One-click **export** and password-confirmed **delete** |

The one-line position: **the AI waiter you can trust** — an assistant whose safety properties are enforced by code and measured by tests, not promised by a prompt.

## Checklist
### Accessibility (WCAG 2.2 AA)
- Met: colour contrast measured for every colour pair actually used, incl. button text (`scripts/check-contrast.ts`); visible keyboard focus; skip link; landmarks (`main`, `nav`); labelled form fields and buttons; `aria-live` for chat updates, cart quantity and status messages; reduced-motion respected; 16px inputs; tap targets 36–44px; works from 320px upward.
- Partly: tested with automated checks and emulated sizes only.
- Not yet: audit with real screen readers (VoiceOver, NVDA, TalkBack), full keyboard walkthrough of the split editor, captions/transcript for voice.

### Privacy and data protection (GDPR, UK GDPR, India DPDP style)
- Met: privacy policy and terms written for what the app really does; consent line at sign-up; only two essential cookies, no trackers, no cookie banner needed; data **export** and **deletion** (password-confirmed); private storage; hashed passwords; data minimisation (no addresses or payment data); AI processors named.
- Partly: retention is "until you delete"; logs expire with the platform's retention.
- Not yet: a legal review of the policy text, a data-processing agreement with each AI vendor, a named contact mailbox, data-residency options, breach-notification process.

### Security
- Met: HTTPS + HSTS, CSP, frame/sniffing/referrer/permissions headers, scrypt hashing, signed HttpOnly session cookie with a dedicated secret, rate limits on sign-in and actions, ownership checks on every order/invoice/feedback/cancel/split call, input validation (Zod and strict parsers), history sanitising against prompt injection, secrets stored as Sensitive.
- Partly: rate limits are per server instance; CSP keeps `'unsafe-inline'` for scripts (Next.js inline scripts) instead of nonces.
- Not yet: email verification, password reset, two-factor sign-in, breached-password check, penetration test, automated dependency scanning in CI.

### Performance and reliability
- Met: static landing page, no-AI paths for routine steps, model failover, a hard daily cap on the paid model, `/api/health` for uptime monitors, friendly error and not-found pages.
- Partly: photos are served straight from Unsplash (no image optimisation, to keep cost flat).
- Not yet: load test, alerting, a status page, a real database (accounts sit in a blob store; the cart is in memory).

### Product and UX
- Met: responsive layouts (laptop, tablet, phone), cart editing (+/−/remove), instant "Added ✓" feedback, thinking indicator, show/hide password with visible rules, clear AI disclosure, empty/error states, share preview image and metadata, structured data.
- Not yet: multiple languages and currencies, real payments, order tracking, delivery, push notifications, installable app (PWA icons).

### AI quality and safety
- Met: grounding, scope gate, code-enforced consent, deterministic maths, eval suite with regression tracking, AI disclosure on screen and in the terms, allergy disclaimer.
- Partly: evals ran on the model used during the build; the live app uses a free-first chain, so the score doesn't automatically carry over.
- Not yet: a held-out eval set, LLM-as-judge for tone, continuous evals on live traffic, red-team report.

## What I'd do next, in order
1. Legal review of the policy/terms and add a real contact mailbox.
2. Email verification + password reset (needs an email provider).
3. Real-screen-reader accessibility pass and fixes.
4. Move accounts, carts and orders to a real database; add alerting.
5. Payments sandbox (Stripe/Razorpay) with proper refund flows.
6. Multi-language (Hindi first) and a held-out, multilingual eval set.
