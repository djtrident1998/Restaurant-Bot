import { convertToModelMessages, createUIMessageStream, createUIMessageStreamResponse, streamText, type UIMessage } from "ai";
import { agentConfig } from "@/lib/agent";
import { buildTools } from "@/lib/tools";
import { streamWithFailover } from "@/lib/failover";
import { availableCandidates, buildModel, cooldownFor, getChain, isPaid, markFailed } from "@/lib/models";
import { getLimits } from "@/lib/config";
import { sanitizeHistory } from "@/lib/sanitize";
import { takeDaily } from "@/lib/budget";
import { checkGrounding, checkUserInput, collectToolAmounts } from "@/lib/guardrails";
import { beginTurn, getOrders, restoreSession, snapshotSession, userConfirm, viewCart } from "@/lib/cart";
import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/auth/store";
import { detectCancelIntent, handleCancelIntent } from "@/lib/cancel";
import { checkRateLimit } from "@/lib/ratelimit";
import { COURSE_ASK_TEXT, courseOutputs, detectMenuIntent } from "@/lib/course";
import { detectOrderIntent, handleOrderIntent, type StaticOutput } from "@/lib/orderFlow";

export const maxDuration = 60;

const MAX_MESSAGES = 14; // history window; every message is re-sent on every model call

function textOf(m: UIMessage | undefined): string {
  return (m?.parts ?? []).map((p) => (p.type === "text" ? p.text : "")).join("");
}

/** A fixed reply streamed like a model answer: text, then tool outputs the UI renders (dish cards, order card). */
function staticReply(text: string, outputs: StaticOutput[] = []) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: ({ writer }) => {
        writer.write({ type: "text-start", id: "static" });
        writer.write({ type: "text-delta", id: "static", delta: text });
        writer.write({ type: "text-end", id: "static" });
        outputs.forEach((o, i) => {
          const toolCallId = `static-${Date.now().toString(36)}-${i}`;
          writer.write({ type: "tool-input-available", toolCallId, toolName: o.toolName, input: o.input });
          writer.write({ type: "tool-output-available", toolCallId, output: o.output });
        });
      },
    }),
  });
}

/**
 * Save orders placed since `before` (the session's order count at the start of the turn) to the signed-in customer's
 * account. Done after a turn succeeds, never inside a tool, so a failed model attempt that is rolled back and
 * retried can never record an order twice.
 */
async function saveOrdersToAccount(sessionId: string, before: number, userId: string | undefined): Promise<void> {
  const placed = getOrders(sessionId).slice(before);
  if (!placed.length || !userId) return;
  try {
    for (const o of placed)
      await getStore().addOrder(userId, {
        id: o.id,
        total: o.cart.total,
        placedAt: o.placedAt,
        lines: o.cart.lines.map((l) => ({ name: l.name, qty: l.qty, lineTotal: l.lineTotal })),
      });
  } catch (e) {
    console.error("[orders] could not save to account", String(e).slice(0, 200));
  }
}

export async function POST(req: Request) {
  const limits = getLimits();
  // Cap the request size BEFORE parsing: the body is untrusted and every byte of history is potential token cost.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > limits.maxBodyBytes) return Response.json({ error: "Request too large." }, { status: 413 });
  let body: { messages?: UIMessage[]; sessionId?: string };
  try {
    const raw = await req.text();
    if (raw.length > limits.maxBodyBytes) return Response.json({ error: "Request too large." }, { status: 413 });
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" && /^[\w-]{8,64}$/.test(body.sessionId) ? body.sessionId : null;
  if (!sessionId || !Array.isArray(body.messages) || body.messages.length === 0)
    return Response.json({ error: "sessionId and messages are required" }, { status: 400 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const messages = body.messages.slice(-MAX_MESSAGES);
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const userText = textOf(lastUser);

  // Guardrail: deterministic scope/injection gate before the model sees anything.
  const gate = checkUserInput(userText);
  if (!gate.ok) return staticReply(gate.reply);

  // Menu browsing is deterministic and free: "show me the menu" asks which course; a course button shows its dishes
  // (built straight from menu.json). No model call, so it is instant and uses none of the AI quota.
  const intent = detectMenuIntent(userText);
  if (intent?.type === "ask") return staticReply(COURSE_ASK_TEXT);
  if (intent?.type === "course") return staticReply(intent.course.intro, courseOutputs(intent.course));

  // The ordering buttons are deterministic too: Add to cart, Checkout and "Yes, place order" are answered by code
  // (same guarded tools, totals and confirm-button rule as the model path) — instant, free, and independent of AI outages.
  // Ordering requires an account: the signed-in user comes from the verified session cookie, never from the client.
  const user = await getCurrentUser();
  const signedIn = !!user;

  const orderIntent = detectOrderIntent(userText);
  if (orderIntent) {
    const ordersBefore = getOrders(sessionId).length;
    const result = handleOrderIntent(sessionId, orderIntent, signedIn, user?.profile);
    await saveOrdersToAccount(sessionId, ordersBefore, user?.id);
    return staticReply(result.text, result.outputs);
  }

  // Cancel / refund requests are answered by code too (never by the AI): explain the rule and offer a confirm button.
  const cancelIntent = detectCancelIntent(userText);
  if (cancelIntent) {
    const r = await handleCancelIntent(getStore(), user?.id, cancelIntent);
    return staticReply(r.text, r.outputs);
  }

  const limit = checkRateLimit(ip, Date.now(), limits);
  if (!limit.ok) return staticReply(limit.reason); // shown in the chat like a normal reply; buttons keep working

  const candidates = availableCandidates(getChain());
  if (candidates.length === 0) return Response.json({ error: "No AI provider is configured." }, { status: 503 });

  beginTurn(sessionId);
  const snapshot = snapshotSession(sessionId);
  // The history comes from the browser, so it is sanitised first: text only, each message truncated, a total
  // character budget, no forged system/tool content (see lib/sanitize.ts).
  const modelMessages = await convertToModelMessages(sanitizeHistory(messages, MAX_MESSAGES, limits), { tools: buildTools(sessionId, signedIn) });

  // Primary model first; if it fails before answering (rate limit, no credits, outage) the next
  // configured backup is tried invisibly, and the failed one is skipped for a couple of minutes.
  // The UI stream masks error text ("An error occurred."), so keep the real provider error for logs/cooldowns.
  const realErrors = new Map<string, unknown>();
  const keyOf = (c: { provider: string; id: string }) => `${c.provider}:${c.id}`;

  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      execute: async ({ writer }) => {
        const winner = await streamWithFailover(
          candidates,
          (c, isLast) =>
            streamText({
              ...agentConfig(sessionId, undefined, buildModel(c), signedIn, user?.profile),
              messages: modelMessages,
              maxRetries: isLast ? 1 : 0, // fail fast on all but the last so a backup is tried quickly
              // Time budget (function limit is 60s): a stuck model must not freeze the reply.
              // 3 backups x 12s + last 22s fits the 60s function limit. Rate-limit failures are instant, so
              // the budget only matters when a provider hangs.
              abortSignal: AbortSignal.timeout(isLast ? 22_000 : 12_000),
              onError: ({ error }) => {
                realErrors.set(keyOf(c), error);
              },
              onFinish: (event) => {
                const { text, steps } = event;
                // Usage log: which model answered and how many tokens it used (visible in Vercel runtime logs).
                const u = ((event as { totalUsage?: unknown }).totalUsage ?? (event as { usage?: unknown }).usage ?? {}) as { inputTokens?: number; outputTokens?: number };
                console.log("[usage]", JSON.stringify({ model: keyOf(c), paid: isPaid(c), in: u.inputTokens, out: u.outputTokens, steps: steps.length }));
                const results = steps.flatMap((s) => s.toolResults.map((r) => (r as { output?: unknown }).output));
                const g = checkGrounding(text, collectToolAmounts([...results, viewCart(sessionId)]));
                if (!g.ok) console.warn("[grounding] flagged reply", JSON.stringify(g));
              },
            }).toUIMessageStream(),
          (chunk) => writer.write(chunk as Parameters<typeof writer.write>[0]),
          {
            // A failed attempt may already have added to the cart etc.; roll back so the next model starts clean.
            beforeAttempt: () => restoreSession(sessionId, snapshot),
            // The paid model is only reached when the free ones failed, and only while today's SHARED budget lasts.
            shouldAttempt: async (c) => !isPaid(c) || (await takeDaily("paid", limits.paidPerDay)),
            onFail: (c, e) => {
              const real = realErrors.get(keyOf(c)) ?? e;
              markFailed(c, Date.now(), cooldownFor(String(real)));
              console.warn(`[failover] ${c.provider}:${c.id} failed, trying next:`, String(real).slice(0, 300));
            },
          },
        );

        // Only after the turn succeeded (a failed attempt is rolled back and retried, so it must not have saved anything).
        if (winner) await saveOrdersToAccount(sessionId, snapshot.orders.length, user?.id);
      },
    }),
  });
}

// The customer's "Yes, place order" button. Consent is recorded server-side for the CURRENT cart; place_order
// refuses without it. It lives in THIS route (not its own /api/confirm) on purpose: on Vercel every route is a
// separate serverless function with separate memory, and the session/cart lives in memory next to the chat route.
// It is deliberately not a model tool, so the model cannot confirm on the customer's behalf.
export async function PUT(req: Request) {
  let sessionId = "";
  try {
    sessionId = String((await req.json()).sessionId ?? "");
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!/^[\w-]{8,64}$/.test(sessionId)) return Response.json({ error: "bad sessionId" }, { status: 400 });
  // Only a signed-in customer can give consent to place an order.
  if (!(await getCurrentUser())) return Response.json({ ok: false, error: "Please sign in to place an order." }, { status: 401 });
  if (!userConfirm(sessionId)) return Response.json({ ok: false, error: "Your cart is empty." }, { status: 409 });
  return Response.json({ ok: true, cart: viewCart(sessionId) });
}

// Lets the UI's cart panel read the authoritative cart without going through the model.
export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get("sessionId") ?? "";
  if (!/^[\w-]{8,64}$/.test(sessionId)) return Response.json({ error: "bad sessionId" }, { status: 400 });
  return Response.json(viewCart(sessionId));
}
