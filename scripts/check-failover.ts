// Offline test of provider failover — uses mock models only, never a real API key.
import { MockLanguageModelV4 } from "ai/test";
import { streamText } from "ai";
import { parseChain, availableCandidates, markFailed, clearCooldowns, cooldownFor, type Candidate } from "../lib/models";
import { streamWithFailover } from "../lib/failover";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

const CHAIN = "groq:openai/gpt-oss-120b,google:gemini-2.5-flash,anthropic:claude-haiku-5-5";
const chain = parseChain(CHAIN);
const env = (o: Record<string, string>) => o as unknown as NodeJS.ProcessEnv;
const ALL_KEYS = env({ GROQ_API_KEY: "x", GOOGLE_GENERATIVE_AI_API_KEY: "x", ANTHROPIC_API_KEY: "x" });

// ---- chain parsing / availability ----
check("parse order", chain.map((c) => c.provider).join() === "groq,google,anthropic");
check("model id with slash kept", chain[0].id === "openai/gpt-oss-120b");
let bad = false;
try { parseChain("openai:gpt"); } catch { bad = true; }
check("unknown provider rejected", bad);
check("all keys -> full order", availableCandidates(chain, ALL_KEYS).length === 3);
check("missing key skipped", availableCandidates(chain, env({ GROQ_API_KEY: "x", ANTHROPIC_API_KEY: "x" })).map((c) => c.provider).join() === "groq,anthropic");
clearCooldowns();
markFailed(chain[0], 1000, 60_000);
check("cooling provider skipped", availableCandidates(chain, ALL_KEYS, 2000).map((c) => c.provider).join() === "google,anthropic");
check("provider returns after cooldown", availableCandidates(chain, ALL_KEYS, 62_000)[0].provider === "groq");
clearCooldowns();
chain.forEach((c) => markFailed(c, 1000, 60_000));
check("all cooling -> still try them", availableCandidates(chain, ALL_KEYS, 2000).length === 3);
clearCooldowns();
check("daily limit -> long cooldown", cooldownFor(new Error("Rate limit ... tokens per day (TPD)")) > cooldownFor(new Error("tokens per minute")));
check("no credits -> long cooldown", cooldownFor("Your credit balance is too low") > cooldownFor("503 overloaded"));

// ---- streaming failover with mock models ----
const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
const goodModel = (text: string) =>
  new MockLanguageModelV4({
    doStream: async () => ({
      stream: new ReadableStream({
        start(ctrl) {
          for (const p of [
            { type: "stream-start", warnings: [] },
            { type: "text-start", id: "1" },
            { type: "text-delta", id: "1", delta: text },
            { type: "text-end", id: "1" },
            { type: "finish", finishReason: { unified: "stop", raw: "stop" }, usage },
          ] as never[]) ctrl.enqueue(p);
          ctrl.close();
        },
      }),
    }),
  });
const rateLimited = () => new MockLanguageModelV4({ doStream: async () => { throw new Error("429 Rate limit reached on tokens per day (TPD)"); } });

async function run(models: Record<string, ReturnType<typeof goodModel>>, candidates: Candidate[]) {
  const out: { type: string; delta?: string; errorText?: string }[] = [];
  const failed: string[] = [];
  const winner = await streamWithFailover(
    candidates,
    (c) => streamText({ model: models[c.provider], prompt: "hi", maxRetries: 0, onError: () => {} }).toUIMessageStream() as AsyncIterable<{ type: string }>,
    (chunk) => out.push(chunk as never),
    (c) => failed.push(c.provider),
  );
  return { winner, failed, text: out.filter((c) => c.type === "text-delta").map((c) => c.delta).join(""), out };
}

(async () => {
  let r = await run({ groq: goodModel("from groq"), google: goodModel("from google"), anthropic: goodModel("from haiku") }, chain);
  check("primary healthy -> groq answers", r.winner?.provider === "groq" && r.text === "from groq" && r.failed.length === 0, r.text);

  r = await run({ groq: rateLimited(), google: goodModel("from google"), anthropic: goodModel("from haiku") }, chain);
  check("groq exhausted -> gemini answers", r.winner?.provider === "google" && r.text === "from google" && r.failed.join() === "groq", r.text);

  r = await run({ groq: rateLimited(), google: rateLimited(), anthropic: goodModel("from haiku") }, chain);
  check("groq+gemini exhausted -> haiku answers", r.winner?.provider === "anthropic" && r.text === "from haiku" && r.failed.join() === "groq,google", r.text);
  check("no duplicate text from failed attempts", r.text === "from haiku");

  r = await run({ groq: rateLimited(), google: rateLimited(), anthropic: rateLimited() }, chain);
  check("all fail -> friendly error chunk", r.winner === null && r.out.some((c) => c.type === "error" && /busy/i.test(c.errorText ?? "")));

  process.exit(fails ? 1 : 0);
})();
