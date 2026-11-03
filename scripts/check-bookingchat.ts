// Offline test of booking and cancelling a table by chat or voice: reading the request, asking for what's missing, offering
// slots, the confirm step, and that nothing is booked or cancelled until the customer confirms.
import { askedFrom, bookRequestText, isBookTalk, isCancelBookingTalk, looksLikeBookingTalk, parseDateWords, parseTimeWords, resolveBookingRequest } from "../lib/bookingIntent";
import { handleBookingRequest } from "../lib/bookingChat";
import { createBooking } from "../lib/bookingService";
import { __testing as bookingTesting } from "../lib/bookings/store";
import { __testing as userTesting, userIdFor, type UserRecord } from "../lib/auth/store";
import { hashPassword } from "../lib/auth/password";
import { detectOrderIntent } from "../lib/orderFlow";
import { detectCancelIntent } from "../lib/cancel";
import { detectMenuIntent } from "../lib/course";
import { SIGN_IN_MARKER } from "../lib/chatMessages";

let fails = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} ${detail}`);
};

// "now" = Tue 3 Nov 2026, 11:30 IST
const NOW = Date.UTC(2026, 10, 3, 6, 0, 0);
const TODAY = "2026-11-03";
const R = (texts: string[], asked: "book" | "cancel" | null = null) => resolveBookingRequest(texts, asked, TODAY);

(async () => {
  // ---------- reading dates, times and party sizes ----------
  check("tomorrow / today / tonight", parseDateWords("tomorrow", TODAY).date === "2026-11-04" && parseDateWords("today", TODAY).date === TODAY && parseDateWords("tonight", TODAY).date === TODAY);
  check("day names (Saturday after Tuesday)", parseDateWords("on saturday", TODAY).date === "2026-11-07" && parseDateWords("tuesday", TODAY).date === TODAY && parseDateWords("next tuesday", TODAY).date === "2026-11-10");
  check("5th November / nov 5 / 5 nov / ISO", ["5th november", "november 5", "5 nov", "2026-11-05"].every((s) => parseDateWords(s, TODAY).date === "2026-11-05"));
  check("a date that already passed this year rolls to next year (then refused by the 30-day rule)", parseDateWords("1 oct", TODAY).date === "2027-10-01");
  check("times: 8 pm, 7:30pm, 20:30, noon, 1 pm", parseTimeWords("8 pm").time === "20:00" && parseTimeWords("7:30pm").time === "19:30" && parseTimeWords("at 20:30").time === "20:30" && parseTimeWords("noon").time === "12:00" && parseTimeWords("1 pm").time === "13:00");
  check("bare hours use the restaurant's hours (at 8 = 8 pm, at 12 = noon, at 1 = 1 pm)", parseTimeWords("at 8").time === "20:00" && parseTimeWords("at 12").time === "12:00" && parseTimeWords("at 1").time === "13:00");
  check("an ISO date is not mistaken for a time", parseTimeWords(parseDateWords("on 2026-11-07", TODAY).rest).time === undefined);

  const full = R(["Book a table for 4 tomorrow at 8 pm"]);
  check("full request in one sentence", full?.kind === "book" && full.date === "2026-11-04" && full.time === "20:00" && full.party === 4, JSON.stringify(full));
  const named = R(["reserve a table for two on saturday at 7:30pm"]);
  check("words for numbers and day names", named?.kind === "book" && named.party === 2 && named.date === "2026-11-07" && named.time === "19:30");
  const iso = R([bookRequestText(5, "2026-11-09", "13:30")]);
  check("a time-slot button's text reads back to exactly the same request", iso?.kind === "book" && iso.party === 5 && iso.date === "2026-11-09" && iso.time === "13:30");
  const bare = R(["I want to book a table"]);
  check("no details yet is still a booking request", bare?.kind === "book" && bare.date === undefined && bare.party === undefined && bare.time === undefined);
  const tonight = R(["can you get me a table for two tonight at 8"]);
  check("casual phrasing", tonight?.kind === "book" && tonight.party === 2 && tonight.date === TODAY && tonight.time === "20:00");
  check("'for 8 pm' is a time, not 8 people", R(["book a table tomorrow for 8 pm"])?.kind === "book" && (R(["book a table tomorrow for 8 pm"]) as { party?: number }).party === undefined);

  // ---------- follow-up answers ----------
  const follow = R(["I want to book a table", "4 people tomorrow at 8"], "book");
  check("an answer to 'what do you need' completes the request", follow?.kind === "book" && follow.party === 4 && follow.date === "2026-11-04" && follow.time === "20:00");
  const bareNum = R(["book a table", "4"], "book");
  check("a bare number answers 'how many people'", bareNum?.kind === "book" && bareNum.party === 4);
  check("an unrelated message never continues an old booking", R(["book a table for 2 tomorrow at 8pm", "what is in the paneer tikka?"], null) === null);
  const reset = R(["book a table for 2 tomorrow at 8pm", "book a table for 4"], null);
  check("a new request starts fresh (old date and time are not carried over)", reset?.kind === "book" && reset.party === 4 && reset.date === undefined && reset.time === undefined);

  // ---------- cancelling ----------
  check("cancel my booking / table / reservation", ["cancel my booking", "Cancel my table reservation", "please cancel the table", "I want to cancel my reservation"].every((s) => R([s])?.kind === "cancel"));
  const cd = R(["cancel my booking for tomorrow"]);
  check("cancel can name a day or a time", cd?.kind === "cancel" && cd.date === "2026-11-04" && (R(["cancel the 8 pm booking"]) as { time?: string }).time === "20:00");
  check("an answer to 'which booking' picks one", (R(["cancel my booking", "the one on saturday"], "cancel") as { date?: string }).date === "2026-11-07");

  // right after a booking was offered or made, a bare "cancel it" means that booking
  const justCancel = ["cancel it", "cancel", "cancel that", "please cancel this booking", "I want to cancel it", "undo"].every((s) => resolveBookingRequest([s], null, TODAY, true)?.kind === "cancel");
  check("'cancel it' / 'cancel' right after a booking cancels that booking", justCancel);
  check("without a booking just made, a bare 'cancel it' is left alone (it could mean an order)", resolveBookingRequest(["cancel it"], null, TODAY, false) === null && resolveBookingRequest(["cancel"], null, TODAY, false) === null);
  // ---------- cancelling a food order by chat or voice ----------
  check("order cancel phrasings: food order / the one I just placed", ["cancel my food order", "cancel the order I just placed", "please cancel my order", "I want to cancel my last order", "cancel order SR-1234"].every((s) => detectCancelIntent(s) !== null));
  check("a bare 'cancel it' cancels the order only right after one was placed", detectCancelIntent("cancel it", true) !== null && detectCancelIntent("cancel", true) !== null && detectCancelIntent("I want to cancel it", true) !== null && detectCancelIntent("cancel it") === null && detectCancelIntent("cancel") === null);
  check("order cancel never fires on dish or chatter", ["do you have a cancel policy", "is the order spicy", "cancel culture"].every((s) => detectCancelIntent(s, true) === null));
  check("'cancel my order' is not a booking request", resolveBookingRequest(["cancel my order"], null, TODAY, false) === null && resolveBookingRequest(["cancel my food order"], null, TODAY, false) === null);

  // ---------- no clash with ordering, menu or order cancelling ----------
  const others = ["Show me the menu", "Add 2 Butter Chicken to my cart", "I'd like to place my order", "cancel my order", "cancel order SR-1234", "I want a refund", "Yes, place the order", "what's the spiciest dish?", "do you have a table cloth?"];
  check("menu, cart, order and refund messages are not booking requests", others.slice(0, 8).every((s) => R([s]) === null && !looksLikeBookingTalk(s)));
  check("'cancel my order' is still an order cancel, not a booking cancel", detectCancelIntent("cancel my order") !== null && !isCancelBookingTalk("cancel my order"));
  check("booking words never trigger an order or menu action", [bookRequestText(4, "2026-11-07", "20:00"), "Book a table for 4 tomorrow at 8 pm", "cancel my booking"].every((s) => detectOrderIntent(s) === null && detectMenuIntent(s) === null));
  check("isBookTalk is strict about length and cancel words", !isBookTalk("book a table ".repeat(30)) && !isBookTalk("cancel my table booking"));

  check("the waiter's questions are recognised on the next turn", askedFrom("Sure. To book your table, I just need how many people") === "book" && askedFrom("Which booking would you like to cancel? Say its day or time") === "cancel" && askedFrom("Hello") === null);

  // ---------- the replies: a clear request is carried out straight away ----------
  const bookings = new bookingTesting.MemoryBookingStore();
  const users = new userTesting.MemoryStore();
  const mk = async (email: string, name: string): Promise<UserRecord> => {
    const u: UserRecord = { id: userIdFor(email), name, email, passwordHash: await hashPassword("Correct-horse-9"), createdAt: 1, orders: [] };
    await users.create(u);
    return u;
  };
  const asha = await mk("asha-bc@example.com", "Asha");
  const ravi = await mk("ravi-bc@example.com", "Ravi");
  const deps = { bookings, users };
  const A = { id: asha.id, name: asha.name };
  const RV = { id: ravi.id, name: ravi.name };
  const ask = (req: Parameters<typeof handleBookingRequest>[2], u: typeof A | null = A) => handleBookingRequest(deps, u ?? undefined, req, NOW);
  const mine = async (date: string, uid = asha.id) => (await bookings.read(date)).filter((b) => b.userId === uid && b.status === "confirmed");

  const guest = await ask({ kind: "book", date: "2026-11-07", time: "20:00", party: 4 }, null);
  check("a guest is asked to sign in (for booking and cancelling)", guest.text.includes(SIGN_IN_MARKER) && (await ask({ kind: "cancel" }, null)).text.includes(SIGN_IN_MARKER) && guest.outputs.length === 0 && (await mine("2026-11-07")).length === 0);

  const missing = await ask({ kind: "book" });
  check("missing details: it asks, and says what it needs", askedFrom(missing.text) === "book" && /how many people/.test(missing.text) && /which day/.test(missing.text) && /what time/.test(missing.text) && missing.outputs.length === 0);
  const noDay = await ask({ kind: "book", party: 4, time: "20:00" });
  check("only the missing parts are asked for", /which day/.test(noDay.text) && !/how many people/.test(noDay.text) && !/what time/.test(noDay.text));

  const noTime = await ask({ kind: "book", date: "2026-11-07", party: 4 });
  const noTimeOut = noTime.outputs[0]?.output as { times: string[] } | undefined;
  check("no time: free times are offered as buttons (nothing booked yet)", noTime.outputs[0]?.toolName === "booking_slots" && !!noTimeOut && noTimeOut.times.length > 0 && noTimeOut.times.length <= 12 && (await mine("2026-11-07")).length === 0);

  const odd = await ask({ kind: "book", date: "2026-11-07", time: "20:15", party: 2 });
  const oddTimes = (odd.outputs[0]?.output as { times: string[] } | undefined)?.times ?? [];
  check("a time that isn't a start time offers the closest ones (nothing booked)", oddTimes.includes("20:00") && oddTimes.includes("20:30") && /isn't a start time/.test(odd.text) && (await mine("2026-11-07")).length === 0);

  check("a party over 8 is sent to the phone", /1 to 8/.test((await ask({ kind: "book", date: "2026-11-07", time: "20:00", party: 12 })).text));
  check("a past or too-distant date is refused politely", /passed/.test((await ask({ kind: "book", date: "2026-11-01", time: "20:00", party: 2 })).text) && /30 days/.test((await ask({ kind: "book", date: "2027-03-01", time: "20:00", party: 2 })).text));

  // a full slot: another customer takes the one 8-seat table, then Asha asks for it
  const taken = await createBooking(bookings, users, RV, { date: "2026-11-09", time: "20:00", party: 8, notes: "" }, NOW);
  const fullSlot = await ask({ kind: "book", date: "2026-11-09", time: "20:00", party: 8 });
  const alt = (fullSlot.outputs[0]?.output as { times: string[] } | undefined)?.times ?? [];
  check("a full slot says so and offers other free times (never the full one)", taken.ok && /full/i.test(fullSlot.text) && !alt.includes("20:00") && alt.length > 0 && (await mine("2026-11-09")).length === 0, JSON.stringify(alt));

  // a complete request is booked straight away
  const done = await ask({ kind: "book", date: "2026-11-07", time: "20:00", party: 4 });
  const doneOut = done.outputs[0];
  const doneBooking = (doneOut?.output as { booking?: { id: string; table: string; time: string } } | undefined)?.booking;
  check("a complete request books the table straight away (no extra tap)", doneOut?.toolName === "booking_done" && !!doneBooking && doneBooking.time === "20:00" && (await mine("2026-11-07")).length === 1 && /Done/.test(done.text) && done.text.includes(doneBooking.id));
  const stored = (await users.findById(asha.id))?.bookings ?? [];
  check("the booking is also on the customer's account", stored.some((b) => b.id === doneBooking?.id && b.status === "confirmed"));
  const clash = await ask({ kind: "book", date: "2026-11-07", time: "20:30", party: 2 });
  check("the booking rules still apply: a clashing booking is refused with the reason", clash.outputs.length === 0 && /around that time/i.test(clash.text) && (await mine("2026-11-07")).length === 1);

  // cancelling
  const nothing = await ask({ kind: "cancel" }, { id: userIdFor("nobody-bc@example.com"), name: "Nobody" });
  check("cancel with nothing booked says so", /don't have an upcoming/.test(nothing.text) && nothing.outputs.length === 0);
  const one = await ask({ kind: "cancel" });
  check("one upcoming booking: 'cancel my booking' cancels it straight away", one.outputs.length === 1 && one.outputs[0].toolName === "booking_cancelled" && (await mine("2026-11-07")).length === 0 && /Done/.test(one.text));
  check("the account copy is cancelled too, so the table is free again", ((await users.findById(asha.id))?.bookings ?? []).every((b) => b.status === "cancelled") && (await ask({ kind: "book", date: "2026-11-07", time: "20:00", party: 4 })).outputs[0]?.toolName === "booking_done");

  // two bookings: it asks which; naming the day cancels that one
  const second = await ask({ kind: "book", date: "2026-11-12", time: "13:00", party: 2 });
  const two = await ask({ kind: "cancel" });
  check("several bookings: it asks which one and cancels nothing", second.outputs[0]?.toolName === "booking_done" && two.outputs.length === 2 && two.outputs.every((o) => o.toolName === "booking_cancel_offer") && askedFrom(two.text) === "cancel" && (await mine("2026-11-12")).length === 1 && (await mine("2026-11-07")).length === 1);
  const byDate = await ask({ kind: "cancel", date: "2026-11-12" });
  check("naming the day cancels the right booking", byDate.outputs[0]?.toolName === "booking_cancelled" && (await mine("2026-11-12")).length === 0 && (await mine("2026-11-07")).length === 1);
  check("an unknown day lists what you have", /couldn't find/.test((await ask({ kind: "cancel", date: "2026-11-20" })).text));

  // 'cancel it' right after a booking was made: the server hands over that booking's id
  const justMade = (await ask({ kind: "book", date: "2026-11-13", time: "19:30", party: 2 })).outputs[0]?.output as { booking: { id: string } };
  const cancelThat = await ask({ kind: "cancel", id: justMade.booking.id });
  check("'cancel it' after a booking cancels exactly that one even when there are several", cancelThat.outputs[0]?.toolName === "booking_cancelled" && (await mine("2026-11-13")).length === 0 && (await mine("2026-11-07")).length === 1);

  // inside the cancellation cut-off nothing is cancelled
  const soon = await createBooking(bookings, users, RV, { date: TODAY, time: "13:00", party: 2, notes: "" }, NOW);
  const soonReply = await ask({ kind: "cancel", date: TODAY }, RV);
  check("a booking inside the 2-hour cut-off isn't cancelled by chat (call the restaurant)", soon.ok && soonReply.outputs.length === 0 && /call|hours/i.test(soonReply.text) && (await mine(TODAY, ravi.id)).length === 1);

  // the 3-booking limit is explained before booking a fourth
  const t2 = await ask({ kind: "book", date: "2026-11-14", time: "19:00", party: 2 });
  const t3 = await ask({ kind: "book", date: "2026-11-16", time: "19:00", party: 2 });
  const limit = await ask({ kind: "book", date: "2026-11-17", time: "19:00", party: 2 });
  check("at the 3-booking limit it explains instead of booking a 4th", t2.outputs[0]?.toolName === "booking_done" && t3.outputs[0]?.toolName === "booking_done" && /3 upcoming/.test(limit.text) && limit.outputs.length === 0 && (await mine("2026-11-17")).length === 0);
  console.log(fails === 0 ? "\nAll chat booking checks passed" : `\n${fails} FAILED`);
  process.exit(fails === 0 ? 0 : 1);
})();
