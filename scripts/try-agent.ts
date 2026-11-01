import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
import { runAgent } from "../lib/agent";
(async () => {
  for (const q of ["where's the paneer tikka?", "do you have sushi?", "what is the capital of France?"]) {
    const r = await runAgent({ sessionId: "try-" + Math.random().toString(36).slice(2, 12), userText: q });
    console.log("\nQ:", q, "\nTools:", r.toolCalls.map((t) => t.name).join(",") || "-", "\nGrounded:", r.grounding.ok, "\nA:", r.reply);
  }
})().catch((e) => { console.error("ERR", e.statusCode ?? "", String(e.message).slice(0, 200)); process.exit(1); });
