import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { CREATOR_GITHUB, CREATOR_NAME, REPO_URL, SITE_NAME, creatorLinkedIn, docUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "About this project",
  description: `${SITE_NAME} is an AI restaurant-ordering product designed and built by ${CREATOR_NAME}, with a PRD, code-enforced guardrails and a measured eval suite.`,
};

const DOCS = [
  { file: "PRD.md", label: "Product requirements (PRD)", note: "Problem, users, metrics, scope, risks" },
  { file: "GUARDRAILS.md", label: "Guardrails", note: "Where each safety rule is enforced, and how it is tested" },
  { file: "EVAL_REPORT.md", label: "Eval report", note: "46 labeled cases, prompt v1 vs v2" },
  { file: "COST_FRAMEWORK.md", label: "Cost and token framework", note: "How it stays affordable under a traffic spike" },
  { file: "GLOBAL_STANDARD.md", label: "Standards checklist", note: "What meets a global bar, and an honest list of gaps" },
];

const BUILT_WITH = ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS", "Vercel AI SDK", "Groq · Gemini · Claude models", "Vercel (hosting + Blob storage)"];

export default function AboutPage() {
  const linkedin = creatorLinkedIn();
  return (
    <LegalPage title="About this project" updated="2 November 2026">
      <section className="card flex items-center gap-4 p-5">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--gold-deep)] text-2xl font-bold text-white" aria-hidden>
          DR
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-muted">Designed &amp; built by</p>
          <p className="font-display text-2xl text-ivory">{CREATOR_NAME}</p>
          <p className="mt-1 flex flex-wrap gap-x-4 text-sm">
            <a href={CREATOR_GITHUB} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              Source code
            </a>
            {linkedin && (
              <a href={linkedin} target="_blank" rel="noopener noreferrer">
                LinkedIn
              </a>
            )}
          </p>
        </div>
      </section>

      <section>
        <h2>What this is</h2>
        <p>
          {SITE_NAME} is a working AI restaurant-ordering product, created by <strong>{CREATOR_NAME}</strong> as an AI product management project. The goal was to show how to ship an AI feature with rigor rather than just a demo: a written PRD, safety rules enforced in code, a measured eval suite, and cost controls for a public launch.
        </p>
        <p className="mt-2">It is a demonstration: it isn&apos;t a real restaurant and takes no real payments.</p>
      </section>

      <section>
        <h2>What&apos;s in it</h2>
        <ul>
          <li>An AI waiter that answers only from the real menu, with every total and split computed in code, never by the model.</li>
          <li>Orders that need a signed-in customer&apos;s button press: the AI cannot place, cancel or refund anything.</li>
          <li>Allergen Shield, group orders with bill splitting, voice input, cancel with refund, invoices and ratings.</li>
          <li>Free-first model failover with a hard daily cap on the paid model.</li>
          <li>Privacy controls (export and delete your data), accessibility checks, and security headers.</li>
        </ul>
      </section>

      <section>
        <h2>The evidence</h2>
        <ul>
          <li>
            <strong>Evals:</strong> on a 46-case labeled suite, tuning the prompt took hallucination from 4.3% to 0% and order safety from 66.7% to 100% (one run; see the report for caveats).
          </li>
          <li>
            <strong>Tests:</strong> 500+ automated offline checks cover the deterministic parts: maths, ordering rules, cancel and refund, splits, privacy, contrast.
          </li>
        </ul>
        <p className="mt-3 font-semibold">Read the documents:</p>
        <ul>
          {DOCS.map((d) => (
            <li key={d.file}>
              <a href={docUrl(d.file)} target="_blank" rel="noopener noreferrer">
                {d.label}
              </a>{" "}
              — <span className="text-muted">{d.note}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Built with</h2>
        <p>{BUILT_WITH.join(" · ")}.</p>
        <p className="mt-2">
          Built with AI assistance (Claude Code as a pair-programmer). Product decisions, scope, priorities and testing were directed by {CREATOR_NAME}, and every commit is public in the{" "}
          <a href={`${REPO_URL}/commits/main`} target="_blank" rel="noopener noreferrer">
            repository history
          </a>
          .
        </p>
      </section>

      <p>
        <Link href="/order" className="btn-gold inline-block px-6 py-3 text-sm no-underline" style={{ color: "#fff", textDecoration: "none" }}>
          Try the AI waiter
        </Link>
      </p>
    </LegalPage>
  );
}
