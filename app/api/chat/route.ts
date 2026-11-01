import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText, type UIMessage } from "ai";
import { agentConfig } from "@/lib/agent";
import { checkGrounding, checkUserInput, collectToolAmounts } from "@/lib/guardrails";
import { beginTurn, viewCart } from "@/lib/cart";

export const maxDuration = 60;

const MAX_MESSAGES = 30;

function textOf(m: UIMessage | undefined): string {
  return (m?.parts ?? []).map((p) => (p.type === "text" ? p.text : "")).join("");
}

export async function POST(req: Request) {
  let body: { messages?: UIMessage[]; sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" && /^[\w-]{8,64}$/.test(body.sessionId) ? body.sessionId : null;
  if (!sessionId || !Array.isArray(body.messages) || body.messages.length === 0)
    return Response.json({ error: "sessionId and messages are required" }, { status: 400 });

  const messages = body.messages.slice(-MAX_MESSAGES);
  const lastUser = [...messages].reverse().find((m) => m.role === "user");

  // Guardrail: deterministic scope/injection gate before the model sees anything.
  const gate = checkUserInput(textOf(lastUser));
  if (!gate.ok) {
    const reply = gate.reply;
    return createUIMessageStreamResponse({
      stream: createUIMessageStream({
        execute: ({ writer }) => {
          writer.write({ type: "text-start", id: "scope" });
          writer.write({ type: "text-delta", id: "scope", delta: reply });
          writer.write({ type: "text-end", id: "scope" });
        },
      }),
    });
  }

  beginTurn(sessionId);
  const config = agentConfig(sessionId);
  const result = streamText({
    ...config,
    messages: await convertToModelMessages(messages),
    onFinish: ({ text, steps }) => {
      const results = steps.flatMap((s) => s.toolResults.map((r) => (r as { output?: unknown }).output));
      const g = checkGrounding(text, collectToolAmounts([...results, viewCart(sessionId)]));
      if (!g.ok) console.warn("[grounding] flagged reply", JSON.stringify(g));
    },
  });

  return result.toUIMessageStreamResponse();
}

// Lets the UI's cart panel read the authoritative cart without going through the model.
export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId") ?? "";
  if (!/^[\w-]{8,64}$/.test(sessionId)) return Response.json({ error: "bad sessionId" }, { status: 400 });
  return Response.json(viewCart(sessionId));
}
