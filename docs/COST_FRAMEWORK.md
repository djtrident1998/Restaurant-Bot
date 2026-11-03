# Cost & token framework

Goal: when the app goes viral (e.g. a LinkedIn post), the bill stays bounded and the site stays up. Every layer below
either avoids a model call, shrinks it, or caps it. Offline tests: `npx tsx scripts/check-limits.ts` (plus the existing suites).

## Layers (cheapest first)

| # | Layer | What it does | Where |
|---|---|---|---|
| 1 | **Static landing page** | `/` reads no cookies, so it is served from the CDN: a traffic spike costs no function runs. The header greets returning users from a display-only `sr_name` cookie. | `app/page.tsx`, `components/LandingHeader.tsx` |
| 2 | **No-AI paths** | Menu browsing, course picker, Add to cart, Checkout, Confirm, and spoken/typed "place order" are answered by code. Zero tokens. | `lib/course.ts`, `lib/orderFlow.ts`, `lib/commands.ts` |
| 3 | **Free-first model chain** | Groq → Gemini (free tiers) → Claude Haiku (paid) last. A failing provider cools down for 2 min (10 min for daily-quota errors). | `lib/models.ts`, `lib/failover.ts` |
| 4 | **Paid-model daily budget** | The paid model is only reached after the free ones fail, and only while a **shared** daily counter (Vercel Blob, ETag-safe, fails closed) has slots. When exhausted, users get a friendly "free capacity reached" message; buttons keep working. | `lib/budget.ts`, `shouldAttempt` in `app/api/chat/route.ts` |
| 5 | **Per-visitor and global limits** | Per-IP per-minute and per-day, plus a global daily cap (per instance, best effort). Over-limit replies appear in the chat, not as errors. | `lib/ratelimit.ts` |
| 6 | **Input caps** | User text ≤ 400 chars (also on the input box and voice). Request body ≤ 400 KB, rejected before parsing (413). | `lib/guardrails.ts`, `app/api/chat/route.ts` |
| 7 | **History sanitiser** | The browser-supplied history is untrusted: text only, tool/reasoning parts and forged `system` messages dropped, each message truncated (800), total budget 8000 chars (newest kept), last 30 messages. The browser also sends only recent text (large menu results are not sent back), so a long chat stays well under the request-size cap. | `lib/sanitize.ts` |
| 8 | **Small prompts & outputs** | Condensed system prompt, compact tool views for the model (`toModelOutput`), `maxOutputTokens` 1200, step cap. | `lib/prompt.ts`, `lib/tools.ts`, `lib/agent.ts` |
| 9 | **Usage logging** | Each answered turn logs `[usage] {"model","paid","in","out","steps"}` in Vercel runtime logs. | `app/api/chat/route.ts` |

### Note on the shared counter (3 Nov 2026)
The shared daily counter, accounts and bookings all use conditional writes on Vercel Blob. In production a conditional write failed with "ETag mismatch" (found while testing table booking). The counter swallowed that error and **failed closed**, so the worst effect was that the paid model stayed off, never extra spend. All Blob writes now go through one tested helper (`lib/blobCas.ts`): the version comes from `head()`, stale reads are re-read instead of written back, and failures are logged (`/api/health/storage` runs a live self-check).

## Tuning (Vercel env vars; redeploy to apply)

| Variable | Default | Meaning |
|---|---|---|
| `LIMIT_PER_MINUTE` | 10 | AI messages per visitor per minute |
| `LIMIT_PER_DAY` | 40 | AI messages per visitor per day |
| `LIMIT_GLOBAL_PER_DAY` | 300 | AI messages per server instance per day |
| `LIMIT_PAID_PER_DAY` | 60 | Calls to the paid model per day, **shared across all instances** |
| `LIMIT_INPUT_CHARS` | 400 | Max characters in one message |
| `LIMIT_HISTORY_MSG_CHARS` | 600 | Max characters kept per history message |
| `LIMIT_HISTORY_TOTAL_CHARS` | 4000 | Total history characters sent to a model |
| `LIMIT_BODY_BYTES` | 400000 | Max request body size |

Worst-case paid spend ≈ `LIMIT_PAID_PER_DAY` × (a few thousand input tokens + ≤1200 output tokens) per day — a few
tenths of a dollar at Haiku prices. Set `LIMIT_PAID_PER_DAY=0` to turn the paid model off entirely.

## Runbook

- **Watch usage:** Vercel → project → Logs, search `[usage]`. `"paid":true` lines are the ones that cost money.
- **Spend nothing:** set `LIMIT_PAID_PER_DAY=0` (or remove `ANTHROPIC_API_KEY`) and redeploy.
- **Under attack / bot traffic:** lower `LIMIT_PER_DAY`, and turn on Vercel Firewall rate limiting or Attack Challenge Mode.
- **Provider-side backstop:** set a monthly spend limit in the Anthropic Console — the last line of defence if everything else fails.
- **Free tiers are small** (Groq ≈ 200k tokens/day, Gemini flash ≈ 20 requests/day). In a big spike the chat will hit
  "free capacity reached" while menu/cart/ordering keep working; that is by design.
- **Known limit:** per-IP counters are per server instance, so under heavy fan-out they multiply. The shared paid budget
  (layer 4) is the hard ceiling on cost.
