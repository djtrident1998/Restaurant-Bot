import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import fs from "node:fs";
import path from "node:path";
import type { ModelMessage } from "ai";
import { runAgent, getModelId, type ToolCallRecord } from "../lib/agent";
import { collectToolAmounts, normalizeText } from "../lib/guardrails";
import { resetSession, userConfirm } from "../lib/cart";
import type { PromptVersion } from "../lib/prompt";

// ---------- types ----------
interface ArgAlt {
  filters?: Record<string, unknown>;
  itemId?: string;
  qty?: number;
  queryIncludes?: string[];
}
interface Expect {
  tools?: string[]; // tools that must be called (empty array = none may be called)
  args?: { tool: string; anyOf: ArgAlt[] };
  mustContain?: string[];
  mustNotContain?: string[];
  honestNo?: boolean;
  decline?: boolean;
  clarify?: boolean;
  cartTotal?: number;
  orderPlaced?: boolean;
  orderTotal?: number;
}
interface Case {
  id: string;
  type: string;
  turns: string[];
  expect: Expect;
}
interface CaseResult {
  id: string;
  type: string;
  pass: boolean;
  checks: Record<string, boolean>;
  failures: string[];
  reply: string;
  tools: string[];
}
interface Metrics {
  toolSelection: number | null;
  argAccuracy: number | null;
  groundingRate: number;
  hallucinationRate: number;
  correctDeclineRate: number | null;
  cartTotalCorrectness: number | null;
  orderSafety: number | null;
  clarifyRate: number | null;
  overallPass: number;
}
interface RunResult {
  version: PromptVersion;
  model: string;
  at: string;
  n: number;
  metrics: Metrics;
  byType: Record<string, { pass: number; total: number }>;
  cases: CaseResult[];
}

// ---------- scoring helpers ----------
const NEGATION = /(don't|do not|doesn't|does not|isn't|is not|aren't|not (on|part of|available)|no (such|sushi|pizza)|unfortunately|sorry|can't|cannot|unable|we only serve|not something we)/i;
const DECLINE = /(can'?t|cannot|won'?t|unable|not able|only|outside|sorry|stay out|here for|focus on|not something)/i;

function matchAlt(call: ToolCallRecord, alt: ArgAlt): boolean {
  const a = (call.args ?? {}) as { query?: string; filters?: Record<string, unknown>; itemId?: string; qty?: number };
  if (alt.itemId !== undefined && a.itemId !== alt.itemId) return false;
  if (alt.qty !== undefined && a.qty !== alt.qty) return false;
  if (alt.queryIncludes && !alt.queryIncludes.some((q) => (a.query ?? "").toLowerCase().includes(q))) return false;
  if (alt.filters) {
    for (const [k, v] of Object.entries(alt.filters)) {
      const got = a.filters?.[k];
      if (k === "maxPrice" || k === "maxSpice") {
        if (typeof got !== "number" || got > (v as number)) return false;
      } else if (got !== v) return false;
    }
  }
  return true;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (i >= 5 || !(status === 429 || (status ?? 0) >= 500)) throw e;
      await new Promise((r) => setTimeout(r, (status === 429 ? 15000 : 2000) * (i + 1))); // free tiers: back off longer
    }
  }
}

async function runCase(c: Case, version: PromptVersion): Promise<CaseResult> {
  const sessionId = `eval-${version}-${c.id}-${Math.random().toString(36).slice(2, 8)}`;
  let history: ModelMessage[] = [];
  const allCalls: ToolCallRecord[] = [];
  const amounts = new Set<number>();
  let groundingOk = true;
  let reply = "";
  let blocked = false;
  let lastCart = { total: 0 };

  for (let turn of c.turns) {
    // "[confirm] ..." simulates the customer pressing the UI's "Yes, place order" button (PUT /api/chat).
    if (turn.startsWith("[confirm] ")) {
      userConfirm(sessionId);
      turn = "Yes, place the order";
    }
    const userText = turn;
    const r = await withRetry(() => runAgent({ sessionId, userText, history, promptVersion: version, priorAmounts: amounts }));
    history = r.messages;
    reply = r.reply;
    blocked = r.blockedByScope;
    allCalls.push(...r.toolCalls);
    for (const a of collectToolAmounts(r.toolCalls.map((t) => t.result))) amounts.add(a);
    if (!r.grounding.ok) groundingOk = false;
    lastCart = r.cart;
  }

  reply = normalizeText(reply);
  const e = c.expect;
  const checks: Record<string, boolean> = { grounding: groundingOk };
  const failures: string[] = [];
  const names = new Set(allCalls.map((t) => t.name));
  const okCalls = (n: string) => allCalls.filter((t) => t.name === n && (t.result as { ok?: boolean } | undefined)?.ok);

  if (e.tools) {
    checks.tools = e.tools.length === 0 ? allCalls.length === 0 : e.tools.every((t) => names.has(t));
  }
  if (e.args) {
    const calls = allCalls.filter((t) => t.name === e.args!.tool);
    checks.args = calls.some((call) => e.args!.anyOf.some((alt) => matchAlt(call, alt)));
  }
  if (e.mustContain) checks.mustContain = e.mustContain.every((s) => reply.toLowerCase().includes(s.toLowerCase()));
  if (e.mustNotContain) checks.mustNotContain = e.mustNotContain.every((s) => !reply.toLowerCase().includes(s.toLowerCase()));
  if (e.honestNo) checks.honestNo = NEGATION.test(reply) && okCalls("add_to_cart").length === 0;
  // Declines must call no tools, signal a refusal, and (via mustNotContain) not leak the off-topic answer.
  if (e.decline) checks.decline = (blocked || DECLINE.test(reply)) && allCalls.length === 0;
  if (e.clarify) checks.clarify = okCalls("add_to_cart").length === 0 && reply.includes("?");
  if (e.cartTotal !== undefined) checks.cartTotal = lastCart.total === e.cartTotal;
  const placed = okCalls("place_order");
  if (e.orderPlaced !== undefined) checks.orderPlaced = (placed.length > 0) === e.orderPlaced;
  if (e.orderTotal !== undefined)
    checks.orderTotal = placed.some((p) => (p.result as { cart?: { total?: number } }).cart?.total === e.orderTotal);

  for (const [k, v] of Object.entries(checks)) if (!v) failures.push(k);
  return { id: c.id, type: c.type, pass: failures.length === 0, checks, failures, reply, tools: allCalls.map((t) => t.name) };
}

function rate(results: CaseResult[], key: string, filter?: (r: CaseResult) => boolean): number | null {
  const rs = results.filter((r) => key in r.checks && (!filter || filter(r)));
  return rs.length ? rs.filter((r) => r.checks[key]).length / rs.length : null;
}

function computeMetrics(results: CaseResult[]): Metrics {
  const declineLike = results.filter((r) => "decline" in r.checks || "honestNo" in r.checks);
  return {
    toolSelection: rate(results, "tools"),
    argAccuracy: rate(results, "args"),
    groundingRate: rate(results, "grounding")!,
    hallucinationRate: 1 - rate(results, "grounding")!,
    correctDeclineRate: declineLike.length
      ? declineLike.filter((r) => r.checks.decline !== false && r.checks.honestNo !== false && r.checks.mustNotContain !== false).length / declineLike.length
      : null,
    cartTotalCorrectness: rate(results, "cartTotal"),
    orderSafety: (() => {
      const rs = results.filter((r) => "orderPlaced" in r.checks);
      return rs.length ? rs.filter((r) => r.checks.orderPlaced && r.checks.orderTotal !== false).length / rs.length : null;
    })(),
    clarifyRate: rate(results, "clarify"),
    overallPass: results.filter((r) => r.pass).length / results.length,
  };
}

async function runVersion(cases: Case[], version: PromptVersion): Promise<RunResult> {
  const results: CaseResult[] = new Array(cases.length);
  let next = 0;
  const worker = async () => {
    while (next < cases.length) {
      const i = next++;
      try {
        results[i] = await runCase(cases[i], version);
      } catch (e) {
        results[i] = { id: cases[i].id, type: cases[i].type, pass: false, checks: { error: false }, failures: ["error"], reply: String((e as Error).message).slice(0, 200), tools: [] };
      }
      process.stdout.write(results[i].pass ? "." : "F");
      resetSession(`eval-${version}-${cases[i].id}`);
    }
  };
  await Promise.all(Array.from({ length: Number(process.env.EVAL_CONCURRENCY ?? 4) }, worker));
  process.stdout.write("\n");
  const byType: RunResult["byType"] = {};
  for (const r of results) {
    byType[r.type] ??= { pass: 0, total: 0 };
    byType[r.type].total++;
    if (r.pass) byType[r.type].pass++;
  }
  return { version, model: getModelId(), at: new Date().toISOString(), n: cases.length, metrics: computeMetrics(results), byType, cases: results };
}

// ---------- reporting ----------
const pct = (v: number | null) => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);

function metricRows(m: Metrics): [string, string][] {
  return [
    ["Tool-selection accuracy", pct(m.toolSelection)],
    ["Argument accuracy", pct(m.argAccuracy)],
    ["Grounding rate (no invented price/dish)", pct(m.groundingRate)],
    ["Hallucination rate", pct(m.hallucinationRate)],
    ["Correct-decline rate (off-topic + honest-no)", pct(m.correctDeclineRate)],
    ["Cart/total correctness", pct(m.cartTotalCorrectness)],
    ["Order safety (confirm-before-order)", pct(m.orderSafety)],
    ["Clarify-when-ambiguous", pct(m.clarifyRate)],
    ["Overall case pass rate", pct(m.overallPass)],
  ];
}

function writeReport(all: Partial<Record<PromptVersion, RunResult>>, file: string) {
  const v1 = all.v1;
  const v2 = all.v2;
  const L: string[] = [];
  L.push("# Spice Route — Eval Report", "");
  L.push(`_Generated by \`npm run eval\`. Model: \`${(v2 ?? v1)!.model}\`. ${(v2 ?? v1)!.n} labeled cases. Raw data: \`evals/results.json\`._`, "");
  L.push("## Scorecard", "");
  const first = (v1 ?? v2)!.metrics;
  L.push(v1 && v2 ? "| Metric | Prompt v1 (baseline) | Prompt v2 (tuned) | Δ |" : "| Metric | Result |", v1 && v2 ? "|---|---|---|---|" : "|---|---|");
  const rows1 = metricRows(v1?.metrics ?? first);
  const rows2 = v2 ? metricRows(v2.metrics) : rows1;
  const raw = (m: Metrics, i: number) => Object.values(m)[[0, 1, 2, 3, 4, 5, 6, 7, 8][i]] as number | null;
  rows1.forEach(([label, a], i) => {
    if (v1 && v2) {
      const x = raw(v1.metrics, i);
      const y = raw(v2.metrics, i);
      const d = x === null || y === null ? "—" : `${y - x >= 0 ? "+" : ""}${((y - x) * 100).toFixed(1)} pts`;
      L.push(`| ${label} | ${a} | ${rows2[i][1]} | ${d} |`);
    } else L.push(`| ${label} | ${a} |`);
  });
  L.push("", "## Pass rate by case type", "");
  L.push("| Type | " + [v1 && "v1", v2 && "v2"].filter(Boolean).join(" | ") + " |", "|---|" + [v1, v2].filter(Boolean).map(() => "---|").join(""));
  const types = Object.keys((v2 ?? v1)!.byType);
  for (const t of types) {
    const cell = (r?: RunResult) => (r ? `${r.byType[t].pass}/${r.byType[t].total}` : null);
    L.push(`| ${t} | ${[cell(v1), cell(v2)].filter(Boolean).join(" | ")} |`);
  }
  for (const r of [v1, v2]) {
    if (!r) continue;
    const bad = r.cases.filter((c) => !c.pass);
    L.push("", `## Failures — prompt ${r.version} (${bad.length}/${r.n})`, "");
    if (!bad.length) L.push("None.");
    for (const c of bad) L.push(`- **${c.id}** (${c.type}) — failed: ${c.failures.join(", ")}. Tools: ${c.tools.join(", ") || "none"}. Reply: _${c.reply.replace(/\s+/g, " ").slice(0, 160)}_`);
  }
  L.push("", "## Caveats", "", "- Results vary run to run (the model's temperature can't be set). Across the runs made while building, v2's overall pass rate ranged 95.7%–100% and v1's 80–89%; the tables above are one run.", "- The test set was used while tuning v2 (read the failures, changed the prompt), so v2's score is optimistic; a held-out set would be the next step.", "- Two scorer false positives were fixed along the way (bold emphasis counted as a dish; decline wording), and the confirm-before-order code guard was tightened to require the read-back in an earlier turn. Both apply to v1 and v2.", "- 46 cases is small: one case is ~2.2 points.", "", "## Method", "", "- Each case runs through the same `runAgent()` the production route uses, including the code-level input gate, tool validation and grounding check.", "- Cart/total correctness is read from the server-side cart, not from the model's text.", "- Hallucination = any reply with a ₹ amount not in the menu or tool results, or a bold dish name not on the menu.", "- Temperature is not controllable on this model, so results can vary slightly between runs.");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, L.join("\n") + "\n");
}

async function main() {
  const arg = process.argv.find((a) => a.startsWith("--version="))?.split("=")[1] ?? "both";
  // --version=report rebuilds docs/EVAL_REPORT.md from the stored evals/results.json without calling the API.
  const versions: PromptVersion[] = arg === "report" ? [] : arg === "both" ? ["v1", "v2"] : [arg as PromptVersion];
  let cases: Case[] = JSON.parse(fs.readFileSync(path.join(__dirname, "testset.json"), "utf8"));
  // EVAL_IDS=fact-01,no-03 runs a subset; EVAL_OUT=results.gemini.json writes elsewhere and skips the shared report.
  if (process.env.EVAL_IDS) {
    const ids = process.env.EVAL_IDS.split(",");
    cases = cases.filter((c) => ids.includes(c.id));
  }
  const resultsFile = path.join(__dirname, process.env.EVAL_OUT ?? "results.json");
  const stored: Partial<Record<PromptVersion, RunResult>> = fs.existsSync(resultsFile) ? JSON.parse(fs.readFileSync(resultsFile, "utf8")) : {};

  for (const v of versions) {
    console.log(`\nRunning ${cases.length} cases with prompt ${v} (${getModelId()})`);
    stored[v] = await runVersion(cases, v);
    console.log(`\n== Scorecard: prompt ${v} ==`);
    console.table(Object.fromEntries(metricRows(stored[v]!.metrics)));
    const bad = stored[v]!.cases.filter((c) => !c.pass);
    for (const c of bad) console.log(`  FAIL ${c.id}: ${c.failures.join(",")} | ${c.reply.replace(/\s+/g, " ").slice(0, 120)}`);
  }
  fs.writeFileSync(resultsFile, JSON.stringify(stored, null, 2));
  if (process.env.EVAL_OUT) {
    console.log(`\nWrote evals/${process.env.EVAL_OUT} (shared report not touched)`);
    return;
  }
  writeReport(stored, path.join(__dirname, "..", "docs", "EVAL_REPORT.md"));
  console.log("\nWrote evals/results.json and docs/EVAL_REPORT.md");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
