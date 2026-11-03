# Spice Route: an AI waiter for restaurant ordering and table booking

**Product Requirements Document**

| | |
|---|---|
| Author | Dibyajyoti Ray |
| Version | v1 MVP |
| Date | 3 November 2026 |
| Status | Live and in use as a working product |
| Live product | [restaurant-bot-three.vercel.app](https://restaurant-bot-three.vercel.app) |
| Source code | [github.com/djtrident1998/Restaurant-Bot](https://github.com/djtrident1998/Restaurant-Bot) |

---

## 1. Summary

Spice Route is an AI waiter for a restaurant. A diner can ask questions about the menu ("something vegetarian, mild, under ₹300"), build a cart by chat or voice, place an order, book a table, cancel, and split the bill with friends.

I built it around one product idea: **in food ordering, trust matters more than fluency.** A chatbot that sounds smart but invents a dish, quotes a wrong price or mishandles an allergy creates a wrong order, a safety problem or a refund dispute. So the AI in this product is allowed to talk, and nothing else. Everything that involves money, safety or consent is done by code that the AI cannot override:

- The AI can only get dishes, prices and allergens by calling a menu lookup. It never sees the menu in its prompt, so it has nothing to invent from.
- Totals, refunds, bill splits and table assignments are calculated by code, never by the AI.
- An order is placed only when the customer presses a confirm button. The server records that press. A typed "yes" is not enough, and the AI has no tool to place, cancel or refund anything.
- A saved allergy profile (the "Allergen Shield") flags every dish in code.
- **A chain of fallback models keeps the product running and keeps the cost down.** Free models answer first. If one is rate-limited or down, the next one takes over without the customer noticing, and the paid model is the last resort behind a hard daily cap. Most steps (menu, cart, checkout, cancel, booking) need no AI call at all, so they keep working even if every model is unavailable.

On my 46-case evaluation set, the tuned version made no invented-dish or invented-price errors, against a 4.3% hallucination rate for the first prompt. I treat that as an early signal, not proof: it was a single run on a set I wrote myself (details in section 9). 759 automated checks cover the rules that must never break.

This document describes the product as it stands, explains the decisions behind it, and sets out how I would measure it, evaluate the AI, and take it from here.

---

## 2. Context and problem

### 2.1 Why this matters now

Conversational ordering is arriving in food delivery. In January 2026 Swiggy let customers order food, groceries and tables through ChatGPT, Claude and Gemini. Zomato took the other route and built an assistant inside its own app (launched September 2023). Both are aggregators. An individual restaurant has no equivalent for its own menu and its own bookings.

The risk is also public. McDonald's ended its AI drive-thru test at more than 100 US restaurants in 2024 after order errors went viral. Vendors who sell AI ordering tools say the same thing in their own guidance: answers about allergens must come from verified menu data and never from a model's general knowledge. A fluent assistant that is occasionally wrong is not good enough here.

### 2.2 The problem

Diners ask the same questions again and again: is it vegetarian, is it mild, what is under ₹300, does it contain nuts, do you have X. Menu PDFs cannot answer questions. General-purpose chatbots can, but they invent dishes and prices. In ordering, an invented fact turns into a wrong order, an allergen incident or a refund.

**Problem statement:** diners want quick, conversational help to order and book, but an assistant that can state a wrong dish, price, allergen or total, or act without the customer's consent, is not safe to put in front of them.

### 2.3 What I have and have not validated

This problem statement comes from desk research and my own understanding of how restaurant ordering works. I have not yet interviewed diners or restaurant owners, and I could not find verifiable public data on how aggregator AI assistants perform (conversion, error rates, retention). The plan to close this gap is in section 12. Everything below should be read with that in mind.

### 2.4 Who feels the problem

| Who | Pain | How the product responds |
|---|---|---|
| Restaurant operator | Staff time goes on repeated questions; wrong orders cost money and trust | Grounded answers from the real menu at any hour |
| Restaurant operator | Fear of an AI taking actions it shouldn't | The AI has no tool to order, cancel or refund |
| Restaurant operator | Unpredictable AI bills if traffic spikes | Free models first, hard cap on the paid one, no-AI paths |
| Restaurant operator | Empty tables and booking friction | Live slots, no double-booking, pre-order once a table is booked |
| Diner | Allergy anxiety and unclear menus | Dish-level flags from a saved profile |
| Diner | Awkward group bills | Split that always adds up to the rupee |

---

## 3. Users and jobs to be done

| User | Priority | What they are trying to do |
|---|---|---|
| Diner with a dietary need (vegetarian, allergy, spice limit) | Primary | See what is safe for them, quickly |
| Decisive diner | Primary | Build a cart, see the exact total, confirm |
| Group host | Secondary | Order for a table and split fairly |
| Returning customer | Secondary | Re-check an order, rate it, get an invoice, cancel |
| Independent restaurant owner or manager (1 to 20 outlets, India) | Future buyer | Answer common questions and fill tables with less staff time |

The jobs, in the customer's words:

- "I have a nut allergy. Show me what I can eat."
- "Add two paneer tikka and three naan. What's my total?"
- "Do you have sushi?" (they expect an honest no)
- "I want a table on Saturday for four, then I'll pre-order."
- "I changed my mind. Cancel it."
- "Split this between six of us."
- "Show me what you store about me, or delete it."

---

## 4. Goals, non-goals and principles

### 4.1 Goals

1. **Trust:** no invented dishes, prices or totals. Allergen information comes only from menu data.
2. **Control:** no irreversible action (order, cancel, refund, booking) without clear intent recorded by the server.
3. **Speed:** from question to confirmed order in a few taps, and a booking in under a minute.
4. **Affordability:** survive a sudden traffic spike without a runaway AI bill.
5. **Credibility:** a sound baseline for accessibility, privacy and security, with the proof (tests, evals, guardrail write-up) visible.

### 4.2 Non-goals for this version

I kept the scope tight so the trust questions could be answered properly first.

- Payment processing and real refunds.
- Delivery logistics: address entry, delivery fees, rider tracking.
- Kitchen or point-of-sale integration, and staff-side table management.
- Email or SMS notifications.
- Languages other than English, and currencies other than rupees.
- Native mobile apps.
- Email verification, password reset and two-factor sign-in.

### 4.3 Principles that shaped the product

1. Ground every fact in the menu.
2. Maths is code, not language.
3. Consent is a button, enforced by the server.
4. Say no honestly and offer real alternatives.
5. Stay in scope; politely refuse everything else.
6. Measure changes; do not judge a prompt by feel.
7. Treat cost as a product requirement.
8. The customer controls their own data.
9. Be open in the interface: say it is an AI, and tell people to confirm allergies with the restaurant.

---

## 5. Solution overview

**Choose how you want to eat.** The landing page opens with a Delivery or Dining choice. I modelled this on how Uber Eats puts an intent switch at the top of the screen, and on how Swiggy Dineout and OpenTable-style flows handle date, party size and live time slots.

- **Delivery** leads to the AI-waiter ordering flow.
- **Dining** leads to "Find a table": date, party size, time, live availability, instant confirmation.

**Order with the AI waiter.** Browse the 42-dish menu by course with no AI involved, or ask free-form questions. Add dishes, see the cart, read the order back, and confirm with the button.

**After the order.** PDF invoice, star rating, cancel within 10 minutes for a full refund (recorded, not paid out), and a bill split for 2 to 12 people, equally or dish by dish.

**Allergen Shield.** The customer saves "vegetarian only" and any of nuts, dairy, gluten, fish or egg to avoid. Every dish card then says whether it fits the profile, and adding a conflicting dish shows a warning.

**Table booking.** Date up to 30 days ahead, party of 1 to 8, 14 seatings (lunch 12:00 to 14:30, dinner 19:00 to 22:30), 90-minute hold, 11 tables and 44 seats assigned by best fit, free cancellation until two hours before, and a calendar file.

**A decision I made from user feedback:** food for dining can be pre-ordered only after a table is booked. Ordering food for a dining visit without a table made no sense, and the first version let people do it. Choosing Dining now shows a single "Book your table first" screen, with the menu and chat unlocked only once a booking is selected. The server enforces this too, so the page cannot be bypassed. Customers can cancel a booking from that same screen.

**Your data.** Download everything stored about you, or delete the account (password required). Deleting an account also frees its tables and removes the name and notes from its bookings.

---

## 6. Requirements

Priority: P0 means the product must not ship without it, P1 is core value, P2 is a useful extra. The last column names how it is verified.

### 6.1 Menu and discovery

| ID | Requirement | Acceptance criterion | Priority | Verified by |
|---|---|---|---|---|
| FR-1 | A 42-dish menu with price, diet, spice, allergens and photo | All fields present; 29 dishes vegetarian | P0 | Menu checks |
| FR-2 | Course picker that needs no AI | "Show me the menu" gives course buttons, then dishes from the data, with no model call | P0 | Course checks |
| FR-3 | Free-form questions answered through a menu lookup only | The AI cannot name a dish or price the lookup did not return; an unknown dish gets an honest no plus real alternatives | P0 | Tool checks, evaluation |
| FR-4 | Dish card with price, diet mark, spice, allergens, quantity 1 to 20, instant "Added" feedback | Visible and usable by keyboard and touch | P1 | Contrast and layout checks |

### 6.2 Cart and ordering

| ID | Requirement | Acceptance criterion | Priority | Verified by |
|---|---|---|---|---|
| FR-5 | Cart add, remove, reduce; maximum 20 per dish; totals computed in code | Totals equal the sum of lines; the AI never states its own total | P0 | Cart checks |
| FR-6 | Add, remove, checkout and confirm work without the AI | Still work when every AI provider is rate-limited | P0 | Order-flow checks |
| FR-7 | Read back every line and the exact total, then a Yes, place order button | An order is placed only if the customer is signed in and pressed the button for the current cart; any change to the cart cancels that consent | P0 | Guardrail checks |
| FR-8 | Ordering needs an account; guests can browse and keep a cart | A guest at checkout is asked to sign in and the cart is kept | P1 | Session checks |
| FR-9 | Voice input with strict command matching | Casual words such as "okay" never place an order | P1 | Voice and command checks |

### 6.3 After the order

| ID | Requirement | Acceptance criterion | Priority | Verified by |
|---|---|---|---|---|
| FR-10 | PDF invoice for the customer's own orders | Another customer's order returns "not found"; cancelled orders are stamped | P1 | Invoice checks |
| FR-11 | 1 to 5 star rating with an optional comment (500 characters) | Own orders only; editable | P2 | Feedback checks |
| FR-12 | Cancel within 10 minutes with a full refund entry | Exactly one refund even on a double click or two tabs; the AI has no cancel tool | P0 | Cancel checks |
| FR-13 | Bill split for 2 to 12 people, equal or by dish | Shares always add up to the total, tested on 300 random splits; amounts recomputed on the server; locked once anyone is marked paid | P1 | Split checks |

### 6.4 Allergen Shield

| ID | Requirement | Acceptance criterion | Priority | Verified by |
|---|---|---|---|---|
| FR-14 | Saved food profile: vegetarian only, avoid nuts, dairy, gluten, fish, egg | Input strictly validated | P1 | Profile checks |
| FR-15 | Dish cards show whether the dish fits the profile; adding a conflicting dish warns | All 42 dishes against all 5 allergens flag exactly as the menu data says | P0 | Profile checks |
| FR-16 | A profile note is added to the AI's instructions | Present only when a profile exists; documented as guidance, not a guarantee | P1 | Profile checks |
| FR-17 | An allergy caveat wherever allergens appear | Wording present on every such screen | P0 | Review |

### 6.5 Delivery or Dining, and table booking

| ID | Requirement | Acceptance criterion | Priority | Verified by |
|---|---|---|---|---|
| FR-18 | Delivery or Dining choice at the start of the landing page and ordering screen | Delivery opens AI ordering; Dining opens Find a table | P1 | Booking checks |
| FR-19 | Live-slot booking with the rules in section 5 | The server validates every field; past or closed slots are refused | P0 | Booking checks |
| FR-20 | No double-booking under simultaneous requests | 12 simultaneous requests for the one 8-seat table give exactly one success; 20 requests for 11 tables give 11 | P0 | Booking checks |
| FR-21 | One booking per overlapping time and at most 3 upcoming per customer | Enforced on the server | P1 | Booking checks |
| FR-22 | Dining food can be ordered only after a table is booked | The menu, cart and chat stay hidden until a booking is selected; the chat service returns a 403 for any dining request without one of the customer's own upcoming bookings, including forged or past booking ids | P0 | Booking checks, live check |
| FR-23 | Cancel a booking (owner only, until two hours before), from the account page and from the dining screen | Inside two hours the screen asks the customer to call; cancelling frees the table | P1 | Booking checks |
| FR-24 | After signing in, return the customer to where they came from | Only same-site booking and ordering pages are accepted; outside links are ignored | P1 | Booking checks |
| FR-25 | Calendar file for a booking, with no personal details | File opens in common calendars | P2 | Booking checks |
| FR-26 | Deleting an account frees its tables and removes name and notes from every booking | Verified after deletion | P0 | Booking checks |
| FR-32 | Book, cancel and move a table, and cancel a food order, by chat or voice in plain language | "book 8 pm today there are 4 people" books a table for 4 at 8 pm; "we can't make it" cancels it; "make it 9 instead" moves it; "I changed my mind about the food" cancels the order. The AI only reads the words into fields; the fields are validated and the request goes through the same booking and cancel rules as the buttons | P0 | Chat booking, plain-language and cancel checks |
| FR-33 | Delivery and Dining each keep their own conversation, cart and voice session | Switching modes shows each mode's own history; nothing from Delivery appears under Dining | P1 | Browser test |

### 6.6 Data and trust

| ID | Requirement | Acceptance criterion | Priority | Verified by |
|---|---|---|---|---|
| FR-27 | Data export as JSON | Includes everything stored about the account, never the password hash | P1 | Privacy checks |
| FR-28 | Account deletion with password confirmation | Account removed; bookings freed and scrubbed | P0 | Privacy checks |
| FR-29 | Privacy policy and terms that match what the product does | Text reviewed against behaviour (legal review still to do) | P1 | Review |
| FR-30 | On-screen notice that answers come from an AI and allergies should be confirmed with the restaurant | Visible on the ordering screen | P0 | Review |
| FR-31 | About page crediting the creator and linking to the evidence | Page live | P2 | Review |

### 6.7 Not built yet

Real delivery flow, reminders, a waitlist, staff table management, one-tap reorder, a "next available" suggestion when a slot is full, and Hindi or other languages.

---

## 7. How the AI works and where the guardrails sit

### 7.1 Design

The assistant has five tools: search the menu, add to cart, read the cart, place the order and check an order. It has **no** tool for cancelling, refunding, splitting or booking, so it cannot do those things however it is asked.

It does not see the menu in its prompt. Dishes, prices and allergens reach it only as results of the menu search, in a compact text form to save tokens. Each turn is limited to 8 tool steps, 1,200 output tokens and the last 40 messages.

**Model fallback: continuity and cost.** One model is a single point of failure and an open-ended bill, so the assistant runs on a chain of four models, tried in order. The first three are free: Groq gpt-oss-120b, Groq gpt-oss-20b and Google Gemini 3.5 Flash. The last is the only paid one, Anthropic Claude Haiku.

- *Why a chain.* Free tiers are small (Groq's allows roughly 200,000 tokens a day and 8,000 a minute; Gemini's about 20 requests a day), so no single free model can carry a public launch. Chaining several lets free capacity cover most traffic, and the paid model is only reached when all the free ones have failed.
- *Disruption.* If a model is rate-limited, out of quota or down, the next one takes over within the same message. Each attempt is run to the end and held back, so the customer sees one clean answer. A failed attempt is rolled back (the cart is restored) and the next model reruns the whole turn, so nothing is added twice.
- *Time limits.* A stuck model is abandoned after 12 seconds (22 for the last one), so a hung provider cannot freeze the chat.
- *Rest period.* A provider that just failed is skipped for 2 minutes, or 10 minutes for a daily-quota error, so the chain does not keep retrying a model that is known to be out.
- *Cost cap.* The paid model is skipped once the shared daily budget is used (default 60 calls a day across all visitors). Setting the cap to 0 turns it off. The budget fails closed: if the counter cannot be read, the paid model is not used.
- *If every model fails.* The customer gets a plain message and the buttons still work, because menu, cart, checkout, cancel and booking do not need a model.
- *Trade-off.* The reply arrives all at once instead of streaming word by word, and the free models are less capable than the paid one. That is why section 9 proposes scoring every model in the chain, and deciding which may answer allergen-related turns.

Steps that need no AI at all: the course picker, add and remove, checkout, confirm, cancel, split, and booking.

### 7.2 What the assistant must and must not do

| Must | Must not |
|---|---|
| Use the menu search for every dish, price and allergen fact | State a dish, price or allergen that the search did not return |
| Say it does not have a dish and offer only real alternatives | Invent an alternative |
| Ask a short question when a request is ambiguous | Guess items or quantities |
| Leave all arithmetic to the tools | Work out or repeat a total of its own |
| Read the cart back and ask the customer to press the button | Treat a typed "yes", or its own summary, as consent |
| Politely refuse off-topic requests and instructions hidden in user text | Follow them |
| Mention the allergy caveat when allergens come up | Call a dish "allergen-free" |
| Keep answering when a model is rate-limited or down, by trying the next model in the chain (free ones first) | Spend on the paid model past the shared daily cap, or leave a half-finished cart after a failed attempt |

### 7.3 Guardrails

I enforce each rule at the layer where it can be checked by code, rather than relying on the prompt.

| Area | Control | Where it lives |
|---|---|---|
| Input | 400-character message limit; 400 KB request limit; a fixed check for off-topic and injection attempts before the model sees anything; chat history treated as untrusted (text only, trimmed, forged system or tool parts removed) | Chat service |
| Grounding | Menu reachable only through the search tool; empty result for unknown dishes; a post-reply check that flags unknown rupee amounts and dish-like phrases | Tools, plus a logged check |
| Actions | Placing an order needs a signed-in customer and a recorded button press for the current cart; no tool exists for cancel, refund, split or booking | Tool layer and server |
| Authorisation | Every order, invoice, rating, cancel, split, booking and export checks that the item belongs to the signed-in account | API routes |
| Business rules | Cancel window, one refund per order, server-side split maths, booking capacity and race protection, dining needs a booking | Stores and routes |
| Allergens | Flags and warnings computed from menu data; the AI's wording is guided | Cards and order flow |
| Cost | Free models first; shared daily cap on the paid model that fails closed; rate limits per visitor and overall; compact prompts | Budget and rate-limit modules |
| Privacy and security | Minimal data; export and deletion; HTTPS and security headers; hashed passwords; signed HttpOnly session cookie; rate-limited sign-in | Account and configuration |

### 7.4 What building this taught me

- My first prompt answered off-topic questions, added up a "₹600 total" on its own and tried to place an order without reading it back.
- The free models treated "place my order", even their own summary, as consent. That is why consent became a server-recorded button press.
- My first confirmation design used a separate route. On a serverless host each route has its own memory, so it saw an empty cart. Confirmation now lives in the chat service.
- A live booking failed to save because of a storage version conflict. I replaced three hand-written versions with one tested helper and added a self-check endpoint.

### 7.5 Known limits

The AI's free-text allergen wording is guided, not guaranteed; the dish flags and the add-to-cart warning are the enforced layer. The post-reply grounding check can flag a reply but cannot take back text that has already streamed. I have not yet run a formal red-team exercise.

---

## 8. Success metrics

The product is not instrumented for a funnel yet, so the targets below are the ones I would hold it to once it is. They give a baseline to set first, then improve against.

### 8.1 North Star

**Trusted orders completed per week:** orders placed with no grounding violation in the conversation, with the customer's own confirmation press, and without a cancellation caused by a wrong item or total.

I chose it over order volume or chat volume because it rewards correct, consented orders. Speed bought at the cost of accuracy is exactly how the drive-thru pilots failed.

### 8.2 Metric tree

| Stage | Metric | How it is defined | Target |
|---|---|---|---|
| Acquisition | Landing to chat start | Sessions opening the order page ÷ landing sessions | Set baseline |
| Acquisition | Delivery versus Dining mix | Share choosing each at the start | Track |
| Activation | Time to first add | Seconds from opening the order page to first dish added | Median 60 s or less |
| Conversion | Cart to order | Orders ÷ carts that reached checkout | Set baseline |
| Conversion | Sign-in drop-off | Carts abandoned at the sign-in step | Falling over time |
| Conversion | Booking completion | Confirmed bookings ÷ sessions with a slot chosen | Set baseline |
| AI quality | Hallucination rate (evaluation) | Answers with an invented dish or price ÷ graded answers | 0% (currently 0.0% on 46 cases) |
| AI quality | Grounding flag rate (live) | Flagged turns ÷ answered turns | 0.5% or less |
| AI quality | Correct decline rate | Off-topic and not-on-menu requests handled correctly | 95% or more (currently 100%) |
| AI quality | Allergen flag accuracy | Dishes and allergens flagged exactly per menu data | 100% (checked for all 42 × 5) |
| Retention | 30-day repeat order | Customers with 2 or more orders in 30 days | Set baseline |
| Retention | Allergen Shield adoption | Signed-in customers with a saved profile | Track |
| Satisfaction | Average rating | 1 to 5 stars | 4.3 or more once there are 30 ratings |
| Operations | Cancel and refund rate | Cancelled ÷ placed | Watch for spikes |
| Operations | Share of turns with no AI call | Turns answered without a model | High and stable |
| Operations | p95 reply time | Request to first reply | 6 s or less |
| Cost | Paid-model calls per day | Against the shared cap | At or under the cap (default 60) |
| Cost and continuity | Free-model share of AI answers | Answers given by a free model ÷ all AI answers | 95% or more |
| Continuity | Turns answered after a fallback | Turns where the first model failed and a later one answered ÷ all AI turns | Track; the customer-facing failure rate should stay near 0% |
| Cost | AI cost per completed order | Model spend ÷ orders | 1% or less of average order value |

### 8.3 Guardrail metrics

A release is blocked if any of these moves the wrong way: an invented dish or price on the evaluation set, any order without a recorded confirmation, any cross-account data read, allergen flag accuracy below 100%, split shares not equal to the total, a double refund, a double-booked table, or the paid cap exceeded.

### 8.4 Counter-metrics

| If this improves | Check that this has not got worse |
|---|---|
| Conversion | Refund and cancel rate, complaints |
| Share of turns with no AI | Unresolved-question rate |
| Reply speed | Grounding flag rate |
| Allergen warnings shown | Add-to-cart rate on flagged dishes (warning fatigue) |

### 8.5 Instrumentation plan

Events with no personal data: landing view, service selected, chat started, course picked, AI answer (model, paid or not, tokens, steps, grounding flag), add to cart, checkout started, sign-in prompted, order confirmed, order placed, order cancelled, rating submitted, profile saved, booking searched, confirmed and cancelled. Today the server logs only usage, failover, grounding and session lines, and the host keeps about an hour of them.

---

## 9. Evaluating the AI

### 9.1 Approach

I evaluate the whole system (prompt, tools, guardrails, failover), not only the model. I separate capability tests (does it help?) from risk tests (can it hurt?). Risk tests are hard gates: if one fails, the release does not go out.

### 9.2 Current results

The evaluation set has 46 labelled cases across menu facts, dietary needs, cart, honest-no, off-topic, ambiguous requests and confirmation. I ran it once at build time on Claude Sonnet 5.5.

| Metric | First prompt | Tuned prompt |
|---|---|---|
| Tool selection accuracy | 96.7% | 100% |
| Argument accuracy | 100% | 100% |
| Grounding rate | 95.7% | 100% |
| Hallucination rate | 4.3% | 0.0% |
| Correct decline (off-topic and not-on-menu) | 84.6% | 100% |
| Cart and total correctness | 100% | 100% |
| Order safety | 66.7% | 100% |
| Overall case pass | 87.0% | 100% |

The evaluation earned its keep: it caught the model reading the cart back from memory (the guard rightly refused the order) and a read-back plus order in a single turn that slipped through an early guard.

### 9.3 How far to trust these numbers

Not very far, yet. It was one run, with only 46 cases, written by me and kept in the same repository as the product, so it was not held out. It ran on a different model from the one that mostly serves live traffic (the free models), and it does not score tone or helpfulness. It is English only and has no hard allergen cases. The 100% figures show that the guardrails work on these cases, not that production accuracy is 100%.

### 9.4 The evaluation suite I would build next

| Suite | What it tests | Cases | How it is graded | Gate |
|---|---|---|---|---|
| A. Facts and grounding | Dish, price, spice and allergen questions | 80 | Automatically against menu data | No invented facts |
| B. Honest no | Dishes not on the menu, including near-misses such as "paneer tikka masala" | 40 | Automatic plus rubric | 95% or more |
| C. Allergen and diet | "Nut-free", "vegan", "gluten-free", combined constraints, misspellings, pressure to confirm safety | 60 | Automatic; any "allergen-free" claim fails | Zero unsafe claims |
| D. Cart and maths | Quantities, removals, totals | 40 | Automatic | 100% |
| E. Consent and actions | "Just place it", typed yes, role-play, instructions hidden in history | 40 | Automatic on the tool calls made | Zero orders without the button |
| F. Scope and injection | Off-topic, jailbreaks, instructions hidden in notes or dish names | 60 | Rubric plus automatic | 98% or more safe |
| G. Ambiguity | Under-specified requests | 30 | AI judge, sampled by a human | 85% or more clarified |
| H. Tone and helpfulness | Brevity, politeness, usefulness | 40 | AI judge calibrated to human labels | No regression |
| I. Hinglish and Hindi | Real user phrasing | 40 | Mixed | Set baseline |

That is about 430 cases, with 20% held out and never used to tune a prompt.

### 9.5 Method

- Score every model in the live chain, not only the best one, and decide which models may answer allergen-related turns.
- Repeat each run three to five times and report the spread, so flaky cases are visible.
- Use an AI judge only for the subjective suites (G and H), after checking it against at least 100 human-labelled examples and reporting how often it agrees with them.
- Re-run suites A to F whenever the prompt, the model chain or a tool changes. The hard gates run in the build pipeline and the results are kept.
- Run the paid model in evaluations only at release time, within a set budget.

### 9.6 Red-team session

One structured session covering prompt injection through every field a user controls, social engineering for refunds or orders, pressure on allergen answers ("you said it was safe"), forged history, attempts to burn through the AI budget, and attempts to read another customer's data. Findings are logged by severity and added to the evaluation set.

### 9.7 Monitoring after launch

| Signal | Source | Action |
|---|---|---|
| Grounding flags ÷ answered turns | Grounding log | Above 0.5%: review a sample, tighten the prompt |
| Failover rate | Failover log | Rising: provider problem |
| Paid calls versus cap | Usage log | Above 80% of cap: alert |
| Cancel and refund spikes | Order events | Check for wrong-item causes |
| Complaints and thumbs-down (to be added) | Feedback | Weekly review of 50 random and all flagged |
| Conversations that mention allergens | Chat log | Human review of every one during any pilot |

### 9.8 Release gates

To ship, all of these must hold: no invented facts on suites A and B, no unsafe allergen claims on C, no orders without the button on E, cart maths 100%, all automated checks passing (759 passing across 25 suites today), no new serious red-team finding, and the paid cap verified. Correct decline of 95% or more, tone not regressing and the reply-time target are tracked as softer gates.

---

## 10. Non-functional requirements

| Area | Requirement | Where it stands |
|---|---|---|
| Accessibility | Target WCAG 2.2 AA. An automated contrast test reads the real theme colours; it found two failures (white on the brand red and orange) and both were fixed | Automated checks and emulated screen sizes only. A screen-reader test is still to do |
| Security | HTTPS, strict headers, hashed passwords, signed session cookie, rate limits, ownership checks | Suitable for a demonstration. Email verification, password reset and two-factor are not built |
| Privacy | Stores name, email, password hash, orders, splits, ratings, food profile and bookings. No addresses or payment details. Two essential cookies only | Policy text has not had legal review |
| Performance | Typical page about 0.3 s from a static landing page | About 1 in 100 requests stalls for roughly 20 s at the hosting layer. I measured this from one network. A retry prompt appears after 6 s |
| Reliability | The chat always answers because deterministic paths do not depend on the AI. Storage errors do not crash pages | No alerting yet |
| Concurrency | One tested conditional-write helper for accounts, bookings and the daily budget | A production self-check endpoint passes |
| Cost | At default limits, worst-case paid spend is a few tenths of a dollar a day; setting the paid cap to 0 turns the paid model off | I still need to set a monthly spend limit in the Anthropic console |

---

## 11. Launch and rollout

- **Done:** build, automated checks, a preview deployment for every feature, and my approval before every production release. Rollback means redeploying the previous build.
- **Portfolio launch:** share the live product on LinkedIn. Before posting I will set the Anthropic spend limit, check the share preview, and do a final run as a stranger: sign up, book a table, cancel it, place an order and rate it.
- **Pilot with a real restaurant (a later decision):** only after evaluation suites A to F pass on every model in the chain, allergen conversations are reviewed by a human, and the terms and privacy text have been reviewed by a lawyer.
- **Controls if something goes wrong:** set the paid cap to 0, lower the per-visitor limits, or turn on the host's attack-challenge mode.

---

## 12. Risks, open questions and next steps

### 12.1 Risks

| Risk | Likelihood | Impact | Mitigation | What remains |
|---|---|---|---|---|
| The AI states a wrong allergen fact | Medium | High | Flags in code, caveat everywhere, allergen gate per model, human review in a pilot | AI wording is guided, not guaranteed |
| A traffic spike drains paid credits | Medium | Medium | Shared cap, free models first, rate limits, spend limit | Low |
| Free models slow down or hit limits | High | Medium | Failover and no-AI paths | Replies may be slower |
| Customers mistake the product for a live restaurant | Medium | Medium | Clear notes in the interface and policies | Low |
| Storage conflicts or lost carts | Medium | Medium | Conditional-write helper, self-check; carts in server memory can reset | Carts may reset |
| Occasional 20-second stalls | Medium | Low to medium | Retry prompt; review hosting region | Not solved |
| Prompt injection | Medium | Medium | Input check, sanitised history, no action tools for the AI | Needs the red-team session |
| Privacy or legal exposure | Low | Medium | Minimal data, export and deletion | Needs legal review |

### 12.2 What I still need to learn

I have not tested the core assumptions with people: that diners want to order conversationally from a single restaurant, that operators would adopt it, that a 10-minute cancel window and a two-hour booking cut-off match how a real kitchen works, and that voice and group ordering will actually be used.

**First four weeks:**

1. Interview 5 to 8 diners, especially people with allergies, and 2 to 3 independent restaurant owners.
2. Watch a small group complete a booking and an order, without helping.
3. Add the funnel events in section 8.5 and set the baselines.
4. Build evaluation suites A to F and run them on every model in the chain.
5. Run one red-team session and fix what it finds.

### 12.3 Open questions

- Is the main audience restaurant operators or reviewers of the portfolio? The About page currently serves both.
- Should the Allergen Shield block a conflicting dish rather than only warn?
- Should "paid" tracking in a split connect to a real UPI link later?
- Is a partial refund needed after the 10-minute window?
- Should I buy a custom domain before the launch post?
- Is a different hosting region the fix for the stalls?

---

## 13. Roadmap

| Order | Item | Why | Size |
|---|---|---|---|
| 1 | Expand the evaluation set, score every model, gate releases | Biggest gap in safety and credibility | Medium |
| 2 | Add funnel instrumentation | No usage data today | Small |
| 3 | User interviews and an observed pilot | Validate the problem | Small |
| 4 | Email verification and password reset | Account safety | Medium |
| 5 | Real delivery flow: address, fee, ETA, tracking | Biggest functional gap | Large |
| 6 | Booking reminders and a "next available" suggestion | Fewer no-shows | Medium |
| 7 | A real database for accounts, carts and orders | Durability | Large |
| 8 | Payments sandbox with real refunds | Completes the order loop | Large |
| 9 | Hindi and Hinglish with matching evaluations | Wider reach | Medium |
| 10 | Screen-reader pass and legal review | Compliance | Small to medium |

---

## Appendix A. Technical summary

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Zod 4 and the Vercel AI SDK 7, with pdf-lib for invoices and Vercel Blob for storage. Hosted on Vercel: a push to the main branch deploys to production and other branches build previews.

Accounts, bookings and the daily budget counter live in a private Blob store behind one conditional-write helper. Carts live in server memory. Pages: home, order, book, account, sign in, sign up, about, privacy and terms. APIs cover chat, feedback, invoices, order cancel and split, profile, data export, bookings (availability, create, cancel) and health checks.

## Appendix B. Data model

- **Account:** id, name, email, password hash, created date, profile, orders, bookings.
- **Order:** id, total, time placed, lines, service (delivery or dine-in with an optional booking id), feedback, cancellation and refund details, split.
- **Booking:** id, customer, name, date, time, party size, table, notes, status. Stored one file per day.

## Appendix C. References

| No. | Topic | Source | Link |
|---|---|---|---|
| 1 | Swiggy ordering through ChatGPT, Claude and Gemini (January 2026) | YourStory | [yourstory.com/2026/01/swiggy-lets-users-order-through-chatgpt-claude-gemini](https://yourstory.com/2026/01/swiggy-lets-users-order-through-chatgpt-claude-gemini) |
| 2 | Zomato's in-app AI assistant | Inc42 | [inc42.com/buzz/zomato-introduces-ai-powered-assistant-to-help-customers-place-orders](https://inc42.com/buzz/zomato-introduces-ai-powered-assistant-to-help-customers-place-orders) |
| 3 | McDonald's ending its AI drive-thru test (June 2024) | Information Age (ACS) | [ia.acs.org.au/article/2024/mcdonald-s-bins-ai-drive-thru-after-errors-go-viral.html](https://ia.acs.org.au/article/2024/mcdonald-s-bins-ai-drive-thru-after-errors-go-viral.html) |
| 4 | Guidance on allergen answers in restaurant AI | Hostie | [hostie.ai/resources/voice-ai-allergy-dietary-questions-menu-aware-bots-2025](https://www.hostie.ai/resources/voice-ai-allergy-dietary-questions-menu-aware-bots-2025) |
| 5 | Structure for AI product requirement documents | Uvik | [uvik.net/blog/ai-prd-template](https://uvik.net/blog/ai-prd-template/) |

If a link does not open from your PDF viewer, copy the address shown in the Link column into a browser.
