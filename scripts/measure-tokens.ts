// Offline estimate of what each model call costs in input tokens (no API calls). Heuristic: ~3.6 chars/token.
import { z } from "zod";
import { buildTools, searchMenuTool, addToCartTool, getCartTool } from "../lib/tools";
import { getSystemPrompt } from "../lib/prompt";
import { beginTurn } from "../lib/cart";

const tok = (s: string) => Math.round(s.length / 3.6);
const tools = buildTools("measure") as unknown as Record<string, { description?: string; inputSchema: z.ZodType; toModelOutput?: (o: { toolCallId: string; input: unknown; output: unknown }) => { type: string; value: unknown } }>;

const schemaText = Object.entries(tools)
  .map(([name, t]) => `${name}:${t.description ?? ""}:${JSON.stringify(z.toJSONSchema(t.inputSchema))}`)
  .join("\n");

const modelView = (name: string, output: unknown) => {
  const t = tools[name];
  if (t.toModelOutput) {
    const r = t.toModelOutput({ toolCallId: "x", input: {}, output });
    return typeof r.value === "string" ? r.value : JSON.stringify(r.value);
  }
  return JSON.stringify(output); // what the model gets when there is no toModelOutput
};

beginTurn("measure");
const samples: [string, unknown][] = [
  ["search_menu (vegan under 300, 12 hits)", searchMenuTool({ query: "", filters: { vegan: true, maxPrice: 300 } })],
  ["search_menu (paneer, 4 hits)", searchMenuTool({ query: "paneer" })],
  ["search_menu (sushi, none + alternatives)", searchMenuTool({ query: "sushi" })],
  ["add_to_cart", addToCartTool("measure", { itemId: "vm-03", qty: 2 })],
  ["get_cart", getCartTool("measure")],
];
const names = ["search_menu", "search_menu", "search_menu", "add_to_cart", "get_cart"];

console.log(`system prompt:      ~${tok(getSystemPrompt("v2"))} tokens`);
console.log(`tool definitions:   ~${tok(schemaText)} tokens`);
console.log(`fixed per call:     ~${tok(getSystemPrompt("v2")) + tok(schemaText)} tokens (sent on EVERY model call)`);
console.log("\ntool result as seen by the model (re-sent on every later call in the turn and in later turns):");
samples.forEach(([label, out], i) => console.log(`  ${label.padEnd(44)} ~${tok(modelView(names[i], out))} tokens`));
const searchHeavy = tok(modelView("search_menu", samples[0][1])) + tok(modelView("add_to_cart", samples[3][1]));
console.log(`\ntypical 3-call turn (search + add + reply): ~${(tok(getSystemPrompt("v2")) + tok(schemaText)) * 3 + searchHeavy * 2} input tokens`);
