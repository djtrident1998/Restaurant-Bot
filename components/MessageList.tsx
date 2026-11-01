import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { ReactNode } from "react";
import { MenuCard, type MenuCardItem } from "./MenuCard";
import { OrderConfirm } from "./OrderConfirm";
import type { CartViewData } from "./CartPanel";

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((s, i) =>
    s.startsWith("**") && s.endsWith("**") ? <strong key={i}>{s.slice(2, -2)}</strong> : <span key={i}>{s}</span>,
  );
}

// Minimal markdown: paragraphs, "- " bullets, **bold**.
function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`} className="my-1 list-disc space-y-1 pl-5">
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

interface Props {
  messages: UIMessage[];
  busy: boolean;
  onAdd: (item: MenuCardItem) => void;
}

export function MessageList({ messages, busy, onAdd }: Props) {
  return (
    <div className="space-y-4" aria-live="polite">
      {messages.map((m) => (
        <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
          <div className={`max-w-[92%] space-y-2 ${m.role === "user" ? "" : "w-full"}`}>
            {m.parts.map((p, i) => {
              if (p.type === "text") {
                if (!p.text.trim()) return null;
                return m.role === "user" ? (
                  <div key={i} className="rounded-2xl rounded-br-sm bg-amber-700 px-4 py-2 text-white">
                    {p.text}
                  </div>
                ) : (
                  <div key={i} className="rounded-2xl rounded-bl-sm border border-stone-200 bg-white px-4 py-2 text-stone-800">
                    <RichText text={p.text} />
                  </div>
                );
              }
              if (isToolUIPart(p) && p.state === "output-available") {
                const name = getToolName(p);
                const out = p.output as { ok?: boolean; items?: MenuCardItem[]; orderId?: string; cart?: CartViewData } | undefined;
                if (name === "search_menu" && out?.ok && out.items?.length) {
                  return (
                    <div key={i} className="grid gap-2 sm:grid-cols-2">
                      {out.items.slice(0, 6).map((it) => (
                        <MenuCard key={it.id} item={it} onAdd={onAdd} disabled={busy} />
                      ))}
                    </div>
                  );
                }
                if (name === "place_order" && out?.ok && out.orderId && out.cart) {
                  return <OrderConfirm key={i} orderId={out.orderId} cart={out.cart} />;
                }
              }
              return null;
            })}
          </div>
        </div>
      ))}
      {busy && <div className="text-sm text-stone-500">Spice Route is typing…</div>}
    </div>
  );
}
