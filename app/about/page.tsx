import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";
import { CREATOR_GITHUB, CREATOR_NAME, REPO_URL, SITE_NAME, creatorLinkedIn, docUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "About this project",
  description: `${SITE_NAME} is an AI restaurant-ordering product designed and built by ${CREATOR_NAME}, with a full PRD, code-enforced guardrails and a measured eval suite.`,
};

// The PRD is the one document: it covers the problem, users, metrics, requirements, guardrails, evaluation plan, cost controls and risks.
const PRD_PDF = "/Spice-Route-PRD.pdf";

const BUILT_WITH = ["Next.js 16", "React 19", "TypeScript", "Tailwind CSS", "Vercel AI SDK", "Groq · Gemini · Claude models", "Vercel (hosting + Blob storage)"];

export default function AboutPage() {
  const linkedin = creatorLinkedIn();
  return (
    <LegalPage title="About this project" updated="3 November 2026">
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
          <li>Orders that need a signed-in customer&apos;s button press: the AI cannot place an order, and it only reads words into fields: cancels, refunds and bookings are carried out by checked code.</li>
          <li>Allergen Shield, group orders with bill splitting, voice input, cancel with refund, invoices and ratings.</li>
          <li>Delivery or Dining at the start, table booking, and booking or cancelling by chat or voice in plain language.</li>
          <li>Free-first model failover with a hard daily cap on the paid model.</li>
          <li>Privacy controls (export and delete your data), accessibility checks, and security headers.</li>
        </ul>
      </section>

      <section>
        <h2>The evidence</h2>
        <ul>
          <li>
            <strong>Evals:</strong> on a 46-case labeled suite, tuning the prompt took hallucination from 4.3% to 0% and order safety from 66.7% to 100% (one run; the PRD explains the caveats and the larger evaluation plan).
          </li>
          <li>
            <strong>Tests:</strong> 750+ automated offline checks cover the deterministic parts: maths, ordering rules, cancel and refund, splits, table booking, privacy, contrast.
          </li>
        </ul>
        <p className="mt-3 font-semibold">Read the product requirements document (PRD):</p>
        <p className="mt-1 text-muted">Problem, users, metrics, requirements, how the AI works and its guardrails, the evaluation plan, cost controls, risks and roadmap, in one document.</p>
        <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
          <a href={PRD_PDF} target="_blank" rel="noopener noreferrer">
            Read the PRD (PDF)
          </a>
          <a href={docUrl("PRD.md")} target="_blank" rel="noopener noreferrer">
            Read the PRD (Markdown)
          </a>
        </p>
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
