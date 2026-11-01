import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText, type UIMessage } from "ai";
import { agentConfig } from "@/lib/agent";
import { streamWithFailover } from "@/lib/failover";
import { availableCandidates, buildModel, cooldownFor, getChain, markFailed } from "@/lib/models";
import { checkGrounding, checkUserInput, collectToolAmounts } from "@/lib/guardrails";
import { beginTurn, restoreSession, snapshotSession, viewCart } from "@/lib/cart";
import { checkRateLimit } from "@/lib/ratelimit";

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

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const limit = checkRateLimit(ip);
  if (!limit.ok) return Response.json({ error: limit.reason }, { status: 429 });

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

  const candidates = availableCandidates(getChain());
  if (candidates.length === 0) return Response.json({ error: "No AI provider is configured." }, { status: 503 });

  beginTurn(sessionId);
  const snapshot = snapshotSession(sessionId);
  const modelMessages = await convertToModelMessages(messages);

  // Primary model first; if it fails before answering (rate limit, no credits, outage) the next
  // configured backup is tried invisibly, and the failed one is skipped for a couple of minutes.
  // The UI stream masks error text ("An error occurred."), so keep the real provider error for logs/cooldowns.
  const realErrors = new Map<string, unknown>();
  const keyOf = (c: { provider: string; id: string }) => `${c.provider}:${c.id}`;

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        await streamWithFailover(
          candidates,
          (c, isLast) =>
            streamText({
              ...agentConfig(sessionId, undefined, buildModel(c)),
              messages: modelMessages,
              maxRetries: isLast ? 1 : 0, // fail fast on all but the last so a backup is tried quickly
              // Time budget (function limit is 60s): a stuck model must not freeze the reply.
              // 3 backups x 12s + last 22s fits the 60s function limit. Rate-limit failures are instant, so
              // the budget only matters when a provider hangs.
              abortSignal: AbortSignal.timeout(isLast ? 22_000 : 12_000),
              onError: ({ error }) => {
                realErrors.set(keyOf(c), error);
              },
              onFinish: ({ text, steps }) => {
                const results = steps.flatMap((s) => s.toolResults.map((r) => (r as { output?: unknown }).output));
                const g = checkGrounding(text, collectToolAmounts([...results, viewCart(sessionId)]));
                if (!g.ok) console.warn("[grounding] flagged reply", JSON.stringify(g));
              },
            }).toUIMessageStream(),
          (chunk) => writer.write(chunk as Parameters<typeof writer.write>[0]),
          {
            // A failed attempt may already have added to the cart etc.; roll back so the next model starts clean.
            beforeAttempt: () => restoreSession(sessionId, snapshot),
            onFail: (c, e) => {
              const real = realErrors.get(keyOf(c)) ?? e;
              markFailed(c, Date.now(), cooldownFor(String(real)));
              console.warn(`[failover] ${c.provider}:${c.id} failed, trying next:`, String(real).slice(0, 300));
            },
          },
        );
      },
    }),
  });
}

// Lets the UI's cart panel read the authoritative cart without going through the model.
export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId") ?? "";
  if (!/^[\w-]{8,64}$/.test(sessionId)) return Response.json({ error: "bad sessionId" }, { status: 400 });
  return Response.json(viewCart(sessionId));
}
