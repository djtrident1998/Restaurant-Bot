# Running on a free model

The app picks its model with two env vars: `MODEL_PROVIDER` (`groq` | `google` | `anthropic`) and `MODEL_ID`. The tools, guardrails and UI are identical for every provider.

| Provider | Model tried | What I saw |
|---|---|---|
| Anthropic | `claude-sonnet-5-5` | 46-case suite: 100% on the recorded run (see `EVAL_REPORT.md`) — but paid per token. |
| Google | `gemini-2.5-flash` | Smoke test invented prices for dishes it recommended after a "no"; the free quota ran out mid-eval, so the 15-case run was inconclusive (9 cases errored). |
| Groq | `openai/gpt-oss-120b` | 15-case subset: **15/15 passed** after fixing two scorer bugs (typographic hyphens/apostrophes). A follow-up full 46-case run was cut short by Groq's free rate limit, so it is **not** a valid full score. |

## What this means
- The free Groq model looks good enough for a demo on the subset, but the full suite has not been scored on it.
- Free tiers are rate-limited. A burst of visitors (or one eval run) can exhaust the quota; the UI then shows a "busy" message. The app also limits each visitor to 12 messages/minute and 150/day, and the whole demo to 1,500/day (best-effort, per server instance).
- Changes made while testing free models (they also apply to Claude):
  - `search_menu` returns real `alternatives` when nothing matches, so an honest "no" can't be padded with invented dishes.
  - The grounding check normalises typographic punctuation and knows common label words.
  - Evals can run a subset (`EVAL_IDS`), write to a separate file (`EVAL_OUT`) and run slower (`EVAL_CONCURRENCY`).

## Token budget (why replies were slow / Groq kept rate-limiting)
Groq's free tier allows 8,000 tokens per minute, and a chat turn makes ~3 model calls that each re-send the whole prompt, tool definitions and history. Measured offline with `npx tsx scripts/measure-tokens.ts` (no API calls, ~3.6 chars/token):

| | Before | After |
|---|---|---|
| System prompt | ~864 | ~648 |
| Tool definitions | ~660 | ~568 |
| Big search result (12 hits) as the model sees it | ~609 | ~167 |
| Typical 3-call turn, input tokens | ~5,940 | ~4,030 (-32%) |

How: tools return full data to the UI (menu cards) but a terse one-line-per-item view to the model (`toModelOutput`, also applied to history), search is capped at 8 items for the model, the prompt is condensed (same rules), and the history window is 14 messages. `scripts/check-modelview.ts` proves, with a mock model, that the model receives the compact view while the UI keeps full data. The condensed prompt has **not** been re-scored on the 46-case eval (that costs API tokens); behaviour was checked on the live site instead.

## Switching
```
MODEL_PROVIDER=groq        # or google / anthropic
MODEL_ID=openai/gpt-oss-120b
GROQ_API_KEY=...           # GOOGLE_GENERATIVE_AI_API_KEY / ANTHROPIC_API_KEY for the others
```
