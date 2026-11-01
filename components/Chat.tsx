"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CartPanel, type CartViewData } from "./CartPanel";
import { DietChip } from "./DietChip";
import { MessageList } from "./MessageList";
import type { MenuCardItem } from "./MenuCard";

const EMPTY_CART: CartViewData = { lines: [], itemCount: 0, total: 0 };

const CHIPS = [
  "Show me the vegan dishes under ₹300",
  "What's popular for non-veg?",
  "Something mild without nuts",
  "What's your spiciest dish?",
  "Desserts",
];

function newSessionId() {
  return `s-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

export function Chat() {
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const send = (text: string) => {
    if (!sessionId || busy || !text.trim()) return;
    sendMessage({ text });
  };

  // After a get_cart read-back (and before an order is placed) offer one-tap yes/no.
  const awaitingConfirm = useMemo(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || busy) return false;
    const names = last.parts.filter(isToolUIPart).map(getToolName);
    return names.includes("get_cart") && !names.includes("place_order") && cart.lines.length > 0;
  }, [messages, busy, cart]);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-5xl flex-col gap-3 p-3 sm:p-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-amber-900">🌶 Spice Route</h1>
          <p className="text-xs text-stone-500">North Indian kitchen · AI waiter demo</p>
        </div>
        <button
          type="button"
          onClick={() => setCartOpen((o) => !o)}
          className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800 lg:hidden"
        >
          Cart · ₹{cart.total}
        </button>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="flex min-h-0 min-w-0 flex-col rounded-xl bg-stone-100/70 p-3">
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <div className="rounded-xl border border-stone-200 bg-white p-4 text-stone-700">
                <p className="font-medium">Namaste! I&apos;m your Spice Route waiter.</p>
                <p className="mt-1 text-sm">Ask about the menu, filter by diet, build your cart and place an order. Try a quick start below.</p>
              </div>
            )}
            <div className="mt-3">
              <MessageList
                messages={messages}
                busy={busy}
                onAdd={(it: MenuCardItem) => send(`Add 1 ${it.name} to my cart`)}
              />
            </div>
            {error && <p className="mt-3 text-sm text-red-700">The demo is busy or has hit its usage limit. Please wait a minute and try again.</p>}
            <div ref={bottomRef} />
          </div>

          {awaitingConfirm && (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={() => send("Yes, place the order")}
                className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-800"
              >
                Yes, place order
              </button>
              <button
                type="button"
                onClick={() => send("No, I want to change something")}
                className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm text-stone-800"
              >
                Change something
              </button>
            </div>
          )}

          <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
            {CHIPS.map((c) => (
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
              placeholder="Ask about the menu or your order…"
              maxLength={1000}
              className="min-w-0 flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-900 outline-none focus:border-amber-600"
            />
            <button
              type="submit"
              disabled={busy || !sessionId || !input.trim()}
              className="rounded-lg bg-amber-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
            >
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
              send("I'd like to place my order");
            }}
          />
        </div>
      </div>
    </div>
  );
}
