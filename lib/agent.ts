import { anthropic } from "@ai-sdk/anthropic";
import { generateText, isStepCount, type ModelMessage } from "ai";
import { buildTools } from "./tools";
import { getSystemPrompt, type PromptVersion } from "./prompt";
import { checkGrounding, checkUserInput, collectToolAmounts, SCOPE_DECLINE, type GroundingResult } from "./guardrails";
import { beginTurn, viewCart, type CartView } from "./cart";

export const MAX_STEPS = 8;

export function getModelId(): string {
  const id = process.env.MODEL_ID;
  if (!id) throw new Error("MODEL_ID env var is not set");
  return id;
}

export function getPromptVersion(): PromptVersion {
  return process.env.PROMPT_VERSION === "v1" ? "v1" : "v2";
}

/** Shared config used by BOTH the streaming route and the headless eval runner. */
export function agentConfig(sessionId: string, promptVersion: PromptVersion = getPromptVersion()) {
  return {
    model: anthropic(getModelId()),
    system: getSystemPrompt(promptVersion),
    tools: buildTools(sessionId),
    stopWhen: isStepCount(MAX_STEPS),
  };
}

export interface ToolCallRecord {
  name: string;
  args: unknown;
  result: unknown;
}

export interface AgentRun {
  reply: string;
  toolCalls: ToolCallRecord[];
  grounding: GroundingResult;
  blockedByScope: boolean;
  cart: CartView;
}

/**
 * Runs one user turn headlessly. `history` is the prior conversation (model messages); the new user
 * text is appended. The same guardrails the route uses are applied here so evals measure real behaviour.
 */
export async function runAgent(opts: {
  sessionId: string;
  userText: string;
  history?: ModelMessage[];
  promptVersion?: PromptVersion;
  priorAmounts?: Iterable<number>;
}): Promise<AgentRun & { messages: ModelMessage[] }> {
  const { sessionId, userText, history = [], promptVersion } = opts;
  const gate = checkUserInput(userText);
  const userMsg: ModelMessage = { role: "user", content: userText };
  if (!gate.ok) {
    return {
      reply: gate.reply ?? SCOPE_DECLINE,
      toolCalls: [],
      grounding: { ok: true, badPrices: [], badDishes: [] },
      blockedByScope: true,
      cart: viewCart(sessionId),
      messages: [...history, userMsg, { role: "assistant", content: gate.reply }],
    };
  }

  beginTurn(sessionId);
  const result = await generateText({
    ...agentConfig(sessionId, promptVersion),
    messages: [...history, userMsg],
  });

  const toolCalls: ToolCallRecord[] = [];
  for (const step of result.steps) {
    for (const tc of step.toolCalls) {
      const tr = step.toolResults.find((r) => r.toolCallId === tc.toolCallId);
      toolCalls.push({ name: tc.toolName, args: (tc as { input?: unknown }).input, result: (tr as { output?: unknown } | undefined)?.output });
    }
  }
  const amounts = collectToolAmounts(toolCalls.map((t) => t.result));
  for (const a of opts.priorAmounts ?? []) amounts.add(a);
  const grounding = checkGrounding(result.text, amounts);

  return {
    reply: result.text,
    toolCalls,
    grounding,
    blockedByScope: false,
    cart: viewCart(sessionId),
    messages: [...history, userMsg, ...result.response.messages],
  };
}
