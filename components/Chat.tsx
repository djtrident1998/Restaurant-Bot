"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, getToolName, isToolUIPart } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CHECKOUT_TEXT, CONFIRM_TEXT, SIGN_IN_MARKER, addRequestText, removeRequestText } from "@/lib/chatMessages";
import { interpretCommand } from "@/lib/commands";
import { AuthPrompt } from "./AuthPrompt";
import { Credit } from "./Credit";
import { COURSES, COURSE_ASK_MARKER, courseRequestText } from "@/lib/courseData";
import { CartPanel, type CartViewData } from "./CartPanel";
import { DietChip } from "./DietChip";
import { MessageList } from "./MessageList";
import { useVoiceInput } from "./useVoiceInput";
import type { MenuCardItem } from "./MenuCard";
import { hasProfile, profileSummary, type Profile } from "@/lib/profile";

const EMPTY_CART: CartViewData = { lines: [], itemCount: 0, total: 0 };

const QUICK = ["Vegan dishes under ₹300", "Something mild without nuts", "What's your spiciest dish?", "What do you recommend?"];

function newSessionId() {
  return `s-${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
}

const COURSE_EMOJI: Record<string, string> = { starters: "🍢", mains: "🍛", "breads-rice": "🫓", desserts: "🍮", drinks: "🥤" };

/** Round category tiles, like a food-delivery app's "What's on your mind?" row. */
function CoursePicker({ onPick, disabled, title }: { onPick: (text: string) => void; disabled?: boolean; title: string }) {
  return (
    <div>
      <p className="font-display text-lg text-ivory">{title}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-4">
        {COURSES.map((c) => (
          <button key={c.key} type="button" disabled={disabled} onClick={() => onPick(courseRequestText(c))} className="cat-tile disabled:opacity-50">
            <span className="cat-icon" aria-hidden>
              {COURSE_EMOJI[c.key] ?? "🍽"}
            </span>
            <span className="text-center text-xs font-semibold leading-tight text-ivory">{c.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export interface LastOrder {
  id: string;
  total: number;
  placedAt: number;
  items: string; // e.g. "2 × Chana Masala, 3 × Tandoori Roti"
}

export function Chat({ userName, signedIn = false, lastOrder, profile }: { userName?: string; signedIn?: boolean; lastOrder?: LastOrder; profile?: Profile }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartViewData>(EMPTY_CART);
  const [input, setInput] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [guestTriedCheckout, setGuestTriedCheckout] = useState(false);
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

  // Voice: speak your question; the words appear in the box as you talk and are sent when you finish.
  const voice = useVoiceInput({
    onInterim: setInput,
    onFinal: (t) => {
      setInput("");
      handleUserText(t);
    },
    onLeftover: setInput, // stopped early: keep what was heard so you can edit or send it
  });

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
    return signedIn && readBack && !placed && cart.lines.length > 0;
  }, [last, lastText, busy, cart, signedIn]);

  // Guests can browse and fill a cart, but must sign in to order: show Sign in / Create account instead of a Yes button.
  const needsSignIn = !signedIn && (guestTriedCheckout || (!busy && last?.role === "assistant" && lastText.toLowerCase().includes(SIGN_IN_MARKER)));

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

  // Spoken or typed ordering commands act like the buttons: "place order" starts checkout; after the read-back,
  // "yes"/"confirm" confirms and "no"/"change" goes back. The server still requires a signed-in session and a
  // recorded confirmation, and the AI can never confirm.
  const handleUserText = (text: string) => {
    const cmd = interpretCommand(text, { awaitingConfirm });
    if (cmd === "confirm") return void confirmOrder();
    if (cmd === "change") return send("No, I want to change something");
    if (cmd === "checkout") {
      if (!signedIn) setGuestTriedCheckout(true);
      return send(CHECKOUT_TEXT);
    }
    send(text);
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[90rem] flex-1 flex-col gap-3 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 lg:pt-4">
      <div className="flex items-center justify-between lg:hidden">
        <span className="text-sm font-bold text-ivory">Your table</span>
        <button type="button" onClick={() => setCartOpen((o) => !o)} className="btn-gold px-4 py-2 text-sm">
          🛒 {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"} · ₹{cart.total}
        </button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[224px_minmax(0,1fr)_330px]">
        {/* Laptop only: a browse rail (categories + quick questions). Phones use the category tiles and chips in the chat. */}
        <nav aria-label="Browse the menu" className="hidden min-h-0 flex-col gap-4 overflow-y-auto lg:flex">
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Menu</p>
            <ul className="mt-2 space-y-1">
              {COURSES.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    disabled={!sessionId || busy}
                    onClick={() => send(courseRequestText(c))}
                    className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-semibold text-ivory transition hover:bg-gold/10 hover:text-gold-soft disabled:opacity-50"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#fff3ef] to-[#ffe3dc] text-lg" aria-hidden>
                      {COURSE_EMOJI[c.key] ?? "🍽"}
                    </span>
                    {c.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Ask the waiter</p>
            <ul className="mt-2 space-y-1.5">
              {QUICK.map((q) => (
                <li key={q}>
                  <button
                    type="button"
                    disabled={!sessionId || busy}
                    onClick={() => send(q)}
                    className="w-full rounded-xl border border-line px-3 py-2 text-left text-sm text-ivory transition hover:border-gold hover:text-gold-soft disabled:opacity-50"
                  >
                    {q}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {signedIn && lastOrder && (
            <Link href="/account" className="card block p-4 text-sm transition hover:border-gold/50">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Your last order</span>
              <span className="mt-1 block font-semibold text-ivory">
                {lastOrder.id} · ₹{lastOrder.total}
              </span>
              <span className="mt-0.5 block text-gold-soft">See all orders →</span>
            </Link>
          )}
          <Credit className="px-1 pb-1 leading-relaxed" />
        </nav>
        <section className="card flex min-h-0 min-w-0 flex-col p-3 sm:p-4">
          {signedIn &&
            (hasProfile(profile) ? (
              <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-green-50 px-3 py-2 text-sm text-green-900" role="note">
                <span>
                  🛡 <strong>Allergen Shield on</strong> — {profileSummary(profile)}
                </span>
                <Link href="/account#profile" className="shrink-0 py-1 font-semibold underline-offset-4 hover:underline">
                  Edit
                </Link>
              </div>
            ) : (
              <div className="mb-2 flex items-center justify-between gap-3 rounded-xl bg-panel2 px-3 py-2 text-sm text-muted" role="note">
                <span>🛡 Tell us your allergies once and every dish gets flagged for you.</span>
                <Link href="/account#profile" className="shrink-0 py-1 font-semibold text-gold-soft underline-offset-4 hover:underline">
                  Set up
                </Link>
              </div>
            ))}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {messages.length === 0 && (
              <div className="fade-up rounded-2xl border border-gold/15 bg-gradient-to-br from-[#fff1ee] via-[#fff7f2] to-panel p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-soft">{userName ? `Welcome back, ${userName}` : "Welcome"}</p>
                <h2 className="font-display mt-1 text-2xl text-ivory sm:text-3xl">Hungry? Your waiter is ready</h2>
                <p className="mt-2 max-w-xl text-sm text-muted">
                  I&apos;m your waiter for the evening. Tell me what you&apos;re in the mood for, or let me guide you through the menu.
                </p>
                {signedIn && lastOrder && (
                  <div className="mt-4 rounded-xl border border-line bg-panel p-3 text-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-soft">Your last order</p>
                    <p className="mt-1 text-ivory">
                      <span className="font-mono">{lastOrder.id}</span> · ₹{lastOrder.total}
                      <span className="text-muted"> · {new Date(lastOrder.placedAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
                    </p>
                    <p className="text-muted">{lastOrder.items}</p>
                    <Link href="/account" className="mt-1 inline-block py-2 font-semibold text-gold-soft underline-offset-4 hover:underline">
                      See all your orders
                    </Link>
                  </div>
                )}
                {!signedIn && (
                  <p className="mt-4 text-sm text-muted">
                    Browse and fill your cart freely.{" "}
                    <Link href="/login" className="text-gold-soft underline-offset-4 hover:underline">
                      Sign in
                    </Link>{" "}
                    or{" "}
                    <Link href="/signup" className="text-gold-soft underline-offset-4 hover:underline">
                      create an account
                    </Link>{" "}
                    when you&apos;re ready to order.
                  </p>
                )}
                <div className="mt-5">
                  <CoursePicker title="What would you like to begin with?" onPick={send} disabled={!sessionId || busy} />
                </div>
              </div>
            )}
            <div className="mt-3">
              <MessageList messages={messages} busy={busy} onAdd={(it: MenuCardItem, qty: number) => send(addRequestText(it.name, qty))} profile={profile} />
            </div>
            {error && <p className="mt-3 text-sm text-red-600">The demo is busy or has hit its usage limit. Please wait a minute and try again.</p>}
            <div ref={bottomRef} />
          </div>

          {courseAsking && (
            <div className="mt-3 rounded-xl border border-line bg-panel2 p-3">
              <CoursePicker title="Choose a course" onPick={send} disabled={busy} />
            </div>
          )}

          {needsSignIn && (
            <div className="mt-3">
              <AuthPrompt />
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
              <span className="self-center text-xs text-muted">Or type or say “yes” to confirm.</span>
            </div>
          )}

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            <DietChip label="Browse the menu" onClick={() => send("Show me the menu")} disabled={busy || !sessionId} />
            {QUICK.map((c) => (
              <DietChip key={c} label={c} onClick={() => send(c)} disabled={busy || !sessionId} />
            ))}
          </div>

          {(voice.listening || voice.error) && (
            <p role="status" className={`mt-2 flex items-center gap-2 text-sm ${voice.error ? "text-red-600" : "text-gold-soft"}`}>
              {voice.listening && !voice.error && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-gold" aria-hidden />}
              {voice.error || "Listening… speak now, then pause. Tap the microphone again to stop."}
            </p>
          )}

          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (voice.listening) voice.stop();
              handleUserText(input);
              setInput("");
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={voice.listening ? "Listening…" : "Ask about a dish, or tell me what you fancy…"}
              maxLength={400}
              className="min-w-0 flex-1 rounded-full border border-line bg-panel2 px-4 py-2.5 text-base text-ivory outline-none placeholder:text-muted/70 focus:border-gold focus:bg-panel"
            />
            <button
              type="button"
              onClick={voice.listening ? voice.stop : voice.start}
              disabled={busy || !sessionId}
              aria-pressed={voice.listening}
              aria-label={voice.listening ? "Stop listening" : "Speak your question"}
              title={voice.supported ? (voice.listening ? "Stop listening" : "Speak your question") : "Voice input isn't available in this browser"}
              className={`btn-ghost flex h-11 w-11 shrink-0 items-center justify-center ${voice.listening ? "mic-listening" : "text-gold-soft"} ${!voice.supported ? "opacity-50" : ""}`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0 0 14 0" />
                <path d="M12 18v3" />
              </svg>
            </button>
            <button type="submit" disabled={busy || !sessionId || !input.trim()} className="btn-gold px-5 py-2.5 text-sm">
              Send
            </button>
          </form>
          <p className="mt-2 text-center text-xs text-muted">AI waiter — answers can be wrong. Please confirm allergies with the restaurant.</p>
        </section>

        {/* Phones: the cart is a bottom sheet over the chat (tap outside or Close to dismiss). Desktop: a side panel. */}
        <div
          className={`${cartOpen ? "fixed inset-0 z-40 flex items-end bg-black/45 lg:static lg:z-auto lg:block lg:bg-transparent" : "hidden lg:block"}`}
          onClick={() => setCartOpen(false)}
        >
          <div
            className="max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-ink p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-2xl lg:h-full lg:max-h-none lg:overflow-visible lg:rounded-none lg:bg-transparent lg:p-0 lg:shadow-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between lg:hidden">
              <span className="mx-auto ml-0 h-1 w-10 rounded-full bg-line" aria-hidden />
              <button type="button" onClick={() => setCartOpen(false)} className="rounded-full px-3 py-1 text-sm font-semibold text-gold-soft">
                Close
              </button>
            </div>
          <CartPanel
            cart={cart}
            disabled={busy || !sessionId}
            signedIn={signedIn}
            onAdjust={(line, delta) => send(delta > 0 ? addRequestText(line.name, 1) : removeRequestText(line.name, 1))}
            onCheckout={() => {
              setCartOpen(false);
              if (!signedIn) {
                setGuestTriedCheckout(true); // no round trip needed: ordering requires an account
                return;
              }
              send(CHECKOUT_TEXT);
            }}
          />
          </div>
        </div>
      </div>
    </div>
  );
}
