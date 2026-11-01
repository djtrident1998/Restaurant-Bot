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

## Switching
```
MODEL_PROVIDER=groq        # or google / anthropic
MODEL_ID=openai/gpt-oss-120b
GROQ_API_KEY=...           # GOOGLE_GENERATIVE_AI_API_KEY / ANTHROPIC_API_KEY for the others
```
