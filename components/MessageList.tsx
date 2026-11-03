import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { ReactNode } from "react";
import { MenuCard, type MenuCardItem } from "./MenuCard";
import { CancelOrder } from "./CancelOrder";
import { BookingCancelOffer, BookingOffer, BookingSlots } from "./BookingChatCards";
import { OrderConfirm } from "./OrderConfirm";
import type { CartViewData } from "./CartPanel";
import type { Profile } from "@/lib/profile";
import type { Service } from "@/lib/service";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((s, i) =>
    s.startsWith("**") && s.endsWith("**") ? (
      <strong key={i} className="font-semibold text-gold-soft">
        {s.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{s}</span>
    ),
  );
}

// Minimal markdown: paragraphs, "- " bullets, **bold**.
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="my-1 list-disc space-y-1 pl-5 marker:text-gold">
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*[-*]\s+(.*)$/);
    if (m) list.push(m[1]);
    else {
      flush();
      if (line.trim()) blocks.push(<p key={`p${blocks.length}`}>{inline(line)}</p>);
    }
  }
  flush();
  return <div className="space-y-1.5">{blocks}</div>;
}

const MAX_CARDS = 8;

interface Props {
  messages: UIMessage[];
  busy: boolean;
  onAdd: (item: MenuCardItem, qty: number) => void;
  /** Sends a message as the customer (used by the time-slot buttons of a booking). */
  onSend?: (text: string) => void;
  profile?: Profile;
}

export function MessageList({ messages, busy, onAdd, onSend, profile }: Props) {
  return (
    <div className="space-y-5" aria-live="polite">
      {messages.map((m) => (
        <div key={m.id} data-msg={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
          <div className={`space-y-3 ${m.role === "user" ? "max-w-[85%]" : "w-full"}`}>
            {m.parts.map((p, i) => {
              if (p.type === "text") {
                if (!p.text.trim()) return null;
                return m.role === "user" ? (
                  <div key={i} className="btn-gold !rounded-2xl !rounded-br-md px-4 py-2 text-[15px] font-medium tracking-normal shadow-none">
                    {p.text}
                  </div>
                ) : (
                  <div key={i} className="rounded-2xl rounded-bl-md border border-line bg-panel2 px-4 py-3 text-[15px] leading-relaxed text-ivory">
                    <RichText text={p.text} />
                  </div>
                );
              }
              if (isToolUIPart(p) && p.state === "output-available") {
                const name = getToolName(p);
                const out = p.output as { ok?: boolean; items?: MenuCardItem[]; orderId?: string; cart?: CartViewData; service?: Service } | undefined;
                if (name === "search_menu" && out?.ok && out.items?.length) {
                  const heading = (p.input as { filters?: { category?: string } } | undefined)?.filters?.category;
                  return (
                    <div key={i}>
                      {heading && (
                        <h3 className="font-display mb-3 mt-1 text-xl text-ivory">{heading}</h3>
                      )}
                      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                        {out.items.slice(0, MAX_CARDS).map((it) => (
                          <MenuCard key={it.id} item={it} onAdd={onAdd} disabled={busy} profile={profile} />
                        ))}
                      </div>
                    </div>
                  );
                }
                if (name === "place_order" && out?.ok && out.orderId && out.cart) {
                  return <OrderConfirm key={i} orderId={out.orderId} cart={out.cart} service={out.service} />;
                }
                if (name === "booking_offer" && out?.ok) {
                  const o = out as unknown as { date: string; time: string; party: number };
                  return <BookingOffer key={i} callKey={p.toolCallId} date={o.date} time={o.time} party={o.party} />;
                }
                if (name === "booking_slots" && out?.ok) {
                  const o = out as unknown as { date: string; party: number; times: string[] };
                  return <BookingSlots key={i} date={o.date} party={o.party} times={o.times} onSend={onSend ?? (() => undefined)} disabled={busy} />;
                }
                if (name === "booking_cancel_offer" && out?.ok) {
                  const o = out as unknown as { booking: { id: string; date: string; time: string; party: number; table: string }; allowed: boolean; message: string };
                  const offers = m.parts.filter((x) => isToolUIPart(x) && getToolName(x) === "booking_cancel_offer").length;
                  return <BookingCancelOffer key={i} callKey={p.toolCallId} booking={o.booking} allowed={o.allowed} message={o.message} single={offers === 1} />;
                }
                if (name === "cancel_offer" && out?.ok && out.orderId) {
                  const o = out as { orderId: string; total: number; minutesLeft: number };
                  return <CancelOrder key={i} orderId={o.orderId} total={o.total} minutesLeft={o.minutesLeft} />;
                }
              }
              return null;
            })}
          </div>
        </div>
      ))}
      {busy && (
        <div role="status" className="flex items-center gap-2 text-sm text-muted">
          <span className="flex gap-1" aria-hidden>
            <span className="h-2 w-2 animate-bounce rounded-full bg-gold [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-gold [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-gold" />
          </span>
          <span>Your waiter is preparing a reply…</span>
        </div>
      )}
    </div>
  );
}
