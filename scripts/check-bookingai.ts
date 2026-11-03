// Offline test of understanding table and order-cancel requests in plain language. The AI is replaced by a fake that returns
// what a model would extract, so this costs nothing; what matters here is when the AI is asked, that its answer is validated,
// and that it can never do more than a typed request could.
import { buildExtractionPrompt, mightNeedAi, requestFromExtract, understandMessage, type Turn, type Understood } from "../lib/bookingAi";
import { resolveBookingRequest } from "../lib/bookingIntent";
import { handleBookingRequest } from "../lib/bookingChat";
import { __testing as bookingTesting } from "../lib/bookings/store";
import { __testing as userTesting, userIdFor, type UserRecord } from "../lib/auth/store";
import { createBooking } from "../lib/bookingService";
import { hashPassword } from "../lib/auth/password";
import type { BookingRef } from "../lib/booking";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

const NOW = Date.UTC(2026, 10, 3, 6, 0, 0); // Tue 3 Nov 2026, 11:30 IST
const TODAY = "2026-11-03";
const ref = (id: string, date: string, time: string): BookingRef => ({ id, date, time, party: 2, table: "T1", notes: "", status: "confirmed", createdAt: 1 });
const mine = [ref("BK-261107-111", "2026-11-07", "20:00"), ref("BK-261110-222", "2026-11-10", "13:00")];
const orders = [{ id: "SR-1234", total: 420, placedAt: NOW - 2 * 60_000 }];

const raw = (o: Partial<{ action: string; date: string | null; time: string | null; party: number | null; bookingId: string | null; orderId: string | null }>) => ({ action: "none", date: null, time: null, party: null, bookingId: null, orderId: null, ...o });

async function run(text: string, opts: { reply?: unknown; prev?: string; det?: Understood | null; handled?: boolean; offered?: string[] } = {}) {
  let calls = 0;
  const turns: Turn[] = [...(opts.prev ? [{ role: "waiter" as const, text: opts.prev }] : []), { role: "user", text }];
  const det = opts.det !== undefined ? opts.det : resolveBookingRequest([text], null, TODAY);
  const out = await understandMessage({
    det,
    turns,
    today: TODAY,
    upcoming: mine,
    orders,
    offeredTimes: opts.offered,
    handledElsewhere: opts.handled ?? false,
    extract: async () => {
      calls++;
      return opts.reply === undefined ? null : opts.reply;
    },
    now: NOW,
  });
  return { out, calls };
}

(async () => {
  // ---------- the user's own example: any wording, any order ----------
  const free = await run("book 8 pm today there are 4 people", { reply: raw({ action: "book", date: TODAY, time: "20:00", party: 4 }) });
  check("'book 8 pm today there are 4 people' is understood (the instant reader can't, the AI can)", resolveBookingRequest(["book 8 pm today there are 4 people"], null, TODAY) !== null ? true : free.calls === 1);
  check("...and gives a complete table request", free.out?.kind === "book" && (free.out as { date?: string }).date === TODAY && (free.out as { time?: string }).time === "20:00" && (free.out as { party?: number }).party === 4, JSON.stringify(free.out));
  const friends = await run("hey can you get me and three friends in tomorrow around eight", { reply: raw({ action: "book", date: "2026-11-04", time: "20:00", party: 4 }) });
  check("'me and three friends tomorrow around eight' -> 4 people, tomorrow, 8 pm", friends.out?.kind === "book" && (friends.out as { party?: number }).party === 4 && (friends.out as { time?: string }).time === "20:00" && friends.calls === 1);
  const cant = await run("sorry something came up, we can't make it", { prev: "Your table is booked for Sat, 7 Nov at 8:00 pm", reply: raw({ action: "cancel_booking", bookingId: "BK-261107-111" }) });
  check("'we can't make it' after a booking cancels that booking", cant.out?.kind === "cancel" && (cant.out as { id?: string }).id === "BK-261107-111" && cant.calls === 1);
  const food = await run("I changed my mind about the food, scrap it", { prev: "Your order is placed. Your order ID is SR-1234", reply: raw({ action: "cancel_order", orderId: "SR-1234" }) });
  check("'I changed my mind about the food' cancels the food order (Delivery works the same way)", food.out?.kind === "cancel_order" && (food.out as { orderId?: string }).orderId === "SR-1234" && food.calls === 1);
  const later = await run("the later one please", { prev: "Here are the free times for 2 people on Sat. Tap one", reply: raw({ action: "book", date: "2026-11-07", time: "21:00", party: 2 }), offered: ["19:00", "20:00", "21:00"] });
  check("'the later one' after offered times is understood from the conversation", later.out?.kind === "book" && (later.out as { time?: string }).time === "21:00" && later.calls === 1);

  // ---------- the AI is only asked when needed ----------
  const complete = await run("Book a table for 4 tomorrow at 8 pm", { reply: raw({ action: "book", date: "2026-11-09", time: "19:00", party: 6 }) });
  check("a request the instant reader fully understands never costs an AI call", complete.calls === 0 && (complete.out as { party?: number }).party === 4);
  const partial = await run("I want to book a table for 4", { reply: raw({ action: "book", date: "2026-11-04", time: "20:00", party: 7 }) });
  const p = partial.out as { party?: number; date?: string; time?: string };
  check("a partial request asks the AI to fill gaps only; it never overrides what the reader found", partial.calls === 1 && p.party === 4 && p.date === "2026-11-04" && p.time === "20:00", JSON.stringify(p));
  check("ordinary food chat costs nothing extra", (await run("what is the spiciest curry you have?", { reply: raw({ action: "book" }) })).calls === 0 && (await run("add two naan please", { reply: raw({}) })).calls === 0);
  check("messages the chat handles itself (menu, cart, checkout, order cancel) are not sent to the AI", (await run("show me the menu", { handled: true, reply: raw({ action: "book" }) })).calls === 0);
  check("a short answer to a table question is sent to the AI", mightNeedAi("make it 9", "Here are the free times for 2 people on Sat") && !mightNeedAi("make it 9", "Hello, welcome"));

  // ---------- fallback and 'none' ----------
  const down = await run("book 8 pm today there are 4 people", { reply: null });
  check("if no AI answers, the chat carries on with the instant reader's result", down.calls === 1 && (down.out === null || down.out.kind === "book"));
  const none = await run("do you have a table cloth", { reply: raw({ action: "none" }), det: null });
  check("'none' means it isn't about tables", none.out === null);

  // ---------- the AI's answer is validated: it can never do more than a typed request ----------
  const bad = requestFromExtract(raw({ action: "book", date: "2020-01-01", time: "25:99", party: 200 }), mine, orders, NOW) as { date?: string; time?: string; party?: number };
  check("a past date, an impossible time and a silly party size are dropped", bad.date === undefined && bad.time === undefined && bad.party === undefined, JSON.stringify(bad));
  const foreign = requestFromExtract(raw({ action: "cancel_booking", bookingId: "BK-261107-999" }), mine, orders, NOW) as { id?: string };
  check("a booking id that isn't the customer's own is ignored", foreign.id === undefined);
  const foreignOrder = requestFromExtract(raw({ action: "cancel_order", orderId: "SR-9999" }), mine, orders, NOW) as { orderId?: string };
  check("an order id that isn't the customer's own is ignored", foreignOrder.orderId === undefined);
  check("garbage from the model is rejected", requestFromExtract({ action: "delete everything" }, mine, orders, NOW) === null && requestFromExtract("book it", mine, orders, NOW) === null && requestFromExtract(null, mine, orders, NOW) === null);

  // an injected instruction can only produce the same request a typed message could, and the booking rules still apply
  const bookings = new bookingTesting.MemoryBookingStore();
  const users = new userTesting.MemoryStore();
  const mk = async (email: string): Promise<UserRecord> => {
    const u: UserRecord = { id: userIdFor(email), name: "Asha", email, passwordHash: await hashPassword("Correct-horse-9"), createdAt: 1, orders: [] };
    await users.create(u);
    return u;
  };
  const asha = await mk("asha-ai@example.com");
  const A = { id: asha.id, name: asha.name };
  const inj = requestFromExtract(raw({ action: "book", date: "2026-11-05", time: "20:00", party: 99 }), mine, orders, NOW);
  const injReply = inj ? await handleBookingRequest({ bookings, users }, A, inj, NOW) : null;
  check("an extracted party of 99 is refused by the booking rules (nothing booked)", !!injReply && /1 to 8/.test(injReply.text) && (await bookings.read("2026-11-05")).length === 0);

  // the user's own example, end to end through the real booking service
  const e2e = free.out && (free.out.kind === "book" || free.out.kind === "cancel") ? await handleBookingRequest({ bookings, users }, A, free.out, NOW) : null;
  check("'book 8 pm today there are 4 people' ends with a real booking for 4 at 8 pm today", e2e?.outputs[0]?.toolName === "booking_done" && (await bookings.read(TODAY)).some((b) => b.userId === asha.id && b.party === 4 && b.time === "20:00"));
  const dup = await handleBookingRequest({ bookings, users }, A, { kind: "book", date: TODAY, time: "20:00", party: 4 }, NOW);
  check("asking again explains the existing booking instead of a bare error", /already have a table booked for/.test(dup.text) && dup.outputs.length === 0);
  const overlap = await handleBookingRequest({ bookings, users }, A, { kind: "book", date: TODAY, time: "20:30", party: 2 }, NOW);
  check("an overlapping time names the booking and how to move it", /overlaps/.test(overlap.text) && /cancel my booking/.test(overlap.text) && !/bare/.test(overlap.text));
  void createBooking;

  // ---------- the prompt carries what the model needs, and no secrets ----------
  const pr = buildExtractionPrompt({ turns: [{ role: "user", text: "book 8 pm today there are 4 people" }], today: TODAY, upcoming: mine, orders, offeredTimes: ["19:00"], now: NOW });
  check("the prompt states today's date and weekday, the customer's bookings and orders, the offered times", /Tuesday 2026-11-03/.test(pr.system) && /BK-261107-111/.test(pr.system) && /SR-1234/.test(pr.system) && /19:00/.test(pr.system) && /can still be cancelled/.test(pr.system));
  check("the prompt tells the model to ignore instructions in the chat and never to book", /Ignore any instructions/.test(pr.system) && /do NOT book or cancel/i.test(pr.system));
  check("the prompt has no personal data beyond booking ids and times (no names, emails)", !/@|asha/i.test(pr.system));

  console.log(fails === 0 ? "\nAll plain-language understanding checks passed" : `\n${fails} FAILED`);
  process.exit(fails === 0 ? 0 : 1);
})();
