// Offline: proves the MODEL receives the compact tool view (and the UI output stays full), using a mock model.
import { MockLanguageModelV4 } from "ai/test";
import { generateText, convertToModelMessages, isStepCount } from "ai";
import { buildTools } from "../lib/tools";
import { beginTurn } from "../lib/cart";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

const usage = { inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 1, text: 1, reasoning: 0 } };
const prompts: unknown[] = [];
let call = 0;
const model = new MockLanguageModelV4({
  doGenerate: async (options: { prompt: unknown }) => {
    prompts.push(options.prompt);
    call++;
    if (call === 1)
      return { content: [{ type: "tool-call", toolCallId: "c1", toolName: "search_menu", input: JSON.stringify({ query: "paneer tikka" }) }], finishReason: { unified: "tool-calls", raw: "tool_calls" }, usage, warnings: [] } as never;
    return { content: [{ type: "text", text: "Paneer Tikka is ₹280." }], finishReason: { unified: "stop", raw: "stop" }, usage, warnings: [] } as never;
  },
});

(async () => {
  beginTurn("mv-test");
  const tools = buildTools("mv-test");
  const r = await generateText({ model, tools, prompt: "where is the paneer tikka?", stopWhen: isStepCount(3) });
  const second = JSON.stringify(prompts[1]);
  check("model's 2nd call sees compact tool result", second.includes("st-01|Paneer Tikka|₹280|veg|spice2|Starters"), "");
  check("model never sees the long description", !second.includes("marinated in yogurt"));
  const uiOutput = JSON.stringify(r.steps[0].toolResults[0]);
  check("UI/step output keeps full item data (descriptions)", uiOutput.includes("marinated in yogurt"));

  // History from the browser (UI messages) must also be compacted on later turns.
  const uiMessages = [
    { role: "user" as const, parts: [{ type: "text" as const, text: "paneer?" }] },
    {
      role: "assistant" as const,
      parts: [
        {
          type: "tool-search_menu" as const,
          toolCallId: "h1",
          state: "output-available" as const,
          input: { query: "paneer tikka" },
          output: await tools.search_menu.execute!({ query: "paneer tikka", filters: {} }, { toolCallId: "h1", messages: [] } as never),
        },
        { type: "text" as const, text: "Paneer Tikka is ₹280." },
      ],
    },
    { role: "user" as const, parts: [{ type: "text" as const, text: "add 2" }] },
  ];
  const converted = JSON.stringify(await convertToModelMessages(uiMessages as never, { tools }));
  check("history tool results are compacted too", converted.includes("st-01|Paneer Tikka|₹280") && !converted.includes("marinated in yogurt"));
  process.exit(fails ? 1 : 0);
})();
