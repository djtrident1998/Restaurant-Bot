"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CHECKOUT_TEXT, CONFIRM_TEXT, addRequestText } from "@/lib/chatMessages";
import { COURSES, COURSE_ASK_MARKER, courseRequestText } from "@/lib/courseData";
import { CartPanel, type CartViewData } from "./CartPanel";
import { DietChip } from "./DietChip";
import { MessageList } from "./MessageList";
import type { MenuCardItem } from "./MenuCard";

const EMPTY_CART: CartViewData = { lines: [], itemCount: 0, total: 0 };

const QUICK = ["Vegan dishes under ₹300", "Something mild without nuts", "What's your spiciest dish?", "What do you recommend?"];

function newSessionId() {
  return `s-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

function CoursePicker({ onPick, disabled, title }: { onPick: (text: string) => void; disabled?: boolean; title: string }) {
  return (
    <div>
      <p className="font-display text-lg text-gold-soft">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {COURSES.map((c) => (
          <button key={c.key} type="button" disabled={disabled} onClick={() => onPick(courseRequestText(c))} className="btn-gold px-5 py-2 text-sm">
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Chat({ userName }: { userName?: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartViewData>(EMPTY_CART);
  const [input, setInput] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let id: string | null = null;
    try {
      id = sessionStorage.getItem("spice-session");
    } catch {}
    if (!id) {
      id = newSessionId();
      try {
        sessionStorage.setItem("spice-session", id);
      } catch {}
    }
    // Session id lives in sessionStorage, so it can only be read after mount (avoids SSR mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSessionId(id);
  }, []);

  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: () => ({ sessionId }) }),
    [sessionId],
  );
  const { messages, sendMessage, status, error } = useChat({ transport });
  const busy = status === "submitted" || status === "streaming";

  const refreshCart = useCallback(async () => {
    if (!sessionId) return;
    try {
      const r = await fetch(`/api/chat?sessionId=${sessionId}`);
      if (r.ok) setCart(await r.json());
    } catch {}
  }, [sessionId]);

  useEffect(() => {
    // Sync the cart panel from the server after each completed turn.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (status === "ready") refreshCart();
  }, [status, refreshCart]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;
    const el = document.querySelector(`[data-msg="${lastMsg.id}"]`);
    // A new list of dishes: start reading at its top. Anything else (text, order card): follow to the bottom.
    if (lastMsg.role === "assistant" && el?.querySelector("article")) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const send = (text: string) => {
    if (!sessionId || busy || !text.trim()) return;
    sendMessage({ text });
  };

  const last = messages[messages.length - 1];
  const lastText = last?.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ") ?? "";

  // The waiter asked "What would you like to begin with?" -> show the course buttons.
  const courseAsking = !busy && last?.role === "assistant" && lastText.includes(COURSE_ASK_MARKER);

  // After a read-back (get_cart, or the waiter asking "place this order?") and before an order is placed,
  // offer one-tap yes/no. The "Yes" button is the ONLY way to confirm: it records consent on the server.
  const awaitingConfirm = useMemo(() => {
    if (!last || last.role !== "assistant" || busy) return false;
    const names = last.parts.filter(isToolUIPart).map(getToolName);
    const readBack = names.includes("get_cart") || /place (this|the|your) order/i.test(lastText);
    // Only a SUCCESSFUL place_order ends the confirmation step; a refused attempt (e.g. a typed "yes") must not hide the button.
    const placed = last.parts.some(
      (p) => isToolUIPart(p) && getToolName(p) === "place_order" && p.state === "output-available" && (p.output as { ok?: boolean } | undefined)?.ok === true,
    );
    return readBack && !placed && cart.lines.length > 0;
  }, [last, lastText, busy, cart]);

  const confirmOrder = async () => {
    if (!sessionId || busy) return;
    try {
      const r = await fetch("/api/chat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!r.ok) return;
    } catch {
      return;
    }
    sendMessage({ text: CONFIRM_TEXT });
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-3 px-3 pb-3 sm:px-5">
      <div className="flex items-center justify-between lg:hidden">
        <span className="text-xs uppercase tracking-[0.25em] text-gold">Your table</span>
        <button type="button" onClick={() => setCartOpen((o) => !o)} className="btn-ghost px-4 py-1.5 text-sm">
          Order · ₹{cart.total}
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
        <section className="card flex min-h-0 min-w-0 flex-col p-3 sm:p-4">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <div className="fade-up rounded-2xl border border-line bg-gradient-to-b from-[#1f1810] to-panel p-5 sm:p-6">
                <p className="text-xs uppercase tracking-[0.3em] text-gold">{userName ? `Welcome back, ${userName}` : "Welcome"}</p>
                <h2 className="font-display mt-1 text-2xl text-ivory sm:text-3xl">Your table is ready</h2>
                <p className="mt-2 max-w-xl text-sm text-muted">
                  I&apos;m your waiter for the evening. Tell me what you&apos;re in the mood for, or let me guide you through the menu.
                </p>
                <div className="mt-5">
                  <CoursePicker title="What would you like to begin with?" onPick={send} disabled={!sessionId || busy} />
                </div>
              </div>
            )}
            <div className="mt-3">
              <MessageList messages={messages} busy={busy} onAdd={(it: MenuCardItem) => send(addRequestText(it.name))} />
            </div>
            {error && <p className="mt-3 text-sm text-red-300">The demo is busy or has hit its usage limit. Please wait a minute and try again.</p>}
            <div ref={bottomRef} />
          </div>

          {courseAsking && (
            <div className="mt-3 rounded-xl border border-line bg-panel2 p-3">
              <CoursePicker title="Choose a course" onPick={send} disabled={busy} />
            </div>
          )}

          {awaitingConfirm && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={confirmOrder} className="btn-gold px-5 py-2 text-sm">
                Yes, place order
              </button>
              <button type="button" onClick={() => send("No, I want to change something")} className="btn-ghost px-5 py-2 text-sm">
                Change something
              </button>
            </div>
          )}

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <DietChip label="Browse the menu" onClick={() => send("Show me the menu")} disabled={busy || !sessionId} />
            {QUICK.map((c) => (
              <DietChip key={c} label={c} onClick={() => send(c)} disabled={busy || !sessionId} />
            ))}
          </div>

          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
              setInput("");
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about a dish, or tell me what you fancy…"
              maxLength={1000}
              className="min-w-0 flex-1 rounded-full border border-line bg-ink px-4 py-2.5 text-base text-ivory outline-none placeholder:text-muted/70 focus:border-gold"
            />
            <button type="submit" disabled={busy || !sessionId || !input.trim()} className="btn-gold px-5 py-2.5 text-sm">
              Send
            </button>
          </form>
        </section>

        <div className={`${cartOpen ? "block" : "hidden"} lg:block`}>
          <CartPanel
            cart={cart}
            disabled={busy}
            onCheckout={() => {
              setCartOpen(false);
              send(CHECKOUT_TEXT);
            }}
          />
        </div>
      </div>
    </div>
  );
}
