import type { UIMessage } from "ai";
import { getLimits, type Limits } from "./config";

/**
 * The chat history arrives from the browser, so it is UNTRUSTED and was previously only length-checked for the last
 * message — a caller could stuff huge old messages (token cost) or forge tool results. Before anything reaches a model:
 *  - only user/assistant text survives (tool results, reasoning and other parts are dropped: smaller, can't be forged,
 *    and no cross-provider metadata problems; the model re-reads the cart/menu with its tools anyway),
 *  - each message is truncated, the whole history has a character budget (newest kept), and
 *  - the history always starts with a user turn.
 */
export function sanitizeHistory(messages: UIMessage[], maxMessages: number, limits: Pick<Limits, "maxHistoryMsgChars" | "maxHistoryTotalChars"> = getLimits()): UIMessage[] {
  const cleaned: UIMessage[] = [];
  for (const m of messages.slice(-maxMessages)) {
    if (m?.role !== "user" && m?.role !== "assistant") continue; // never accept a forged "system" message
    const text = (Array.isArray(m.parts) ? m.parts : [])
      .map((p) => (p && p.type === "text" && typeof p.text === "string" ? p.text : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, limits.maxHistoryMsgChars);
    if (!text) continue;
    cleaned.push({ id: typeof m.id === "string" ? m.id.slice(0, 64) : "m", role: m.role, parts: [{ type: "text", text }] });
  }

  // Character budget: keep the newest messages that fit.
  const kept: UIMessage[] = [];
  let total = 0;
  for (let i = cleaned.length - 1; i >= 0; i--) {
    const len = (cleaned[i].parts[0] as { text: string }).text.length;
    if (total + len > limits.maxHistoryTotalChars && kept.length > 0) break;
    total += len;
    kept.unshift(cleaned[i]);
  }
  while (kept.length > 1 && kept[0].role !== "user") kept.shift();
  return kept;
}
