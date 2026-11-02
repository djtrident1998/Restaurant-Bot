"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { deleteMyAccount } from "@/app/actions/auth";
import type { AuthFormState } from "@/lib/auth/schemas";

/** Privacy controls on the Account page: download your data, or permanently delete your account. */
export function DataControls() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(deleteMyAccount, undefined);
  const [confirming, setConfirming] = useState(false);

  return (
    <section className="card mt-10 p-5" aria-labelledby="data-heading">
      <h2 id="data-heading" className="font-display text-xl text-ivory">
        Your data
      </h2>
      <p className="mt-1 text-sm text-muted">
        You own your data. Download a copy of everything we store about you, or delete your account for good. See our{" "}
        <Link href="/privacy" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
          privacy policy
        </Link>
        .
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <a href="/api/account/export" download className="btn-ghost inline-block px-5 py-2 text-sm">
          Download my data (JSON)
        </a>
        {!confirming && (
          <button type="button" onClick={() => setConfirming(true)} className="rounded-full px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
            Delete my account…
          </button>
        )}
      </div>

      {confirming && (
        <form action={action} className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">This can&apos;t be undone.</p>
          <p className="mt-1 text-sm text-red-900/80">Your profile, order history, ratings and splits will be permanently deleted. Enter your password to confirm.</p>
          <label htmlFor="delete-password" className="mt-3 block text-sm font-semibold text-red-900">
            Password
          </label>
          <input
            id="delete-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="mt-1 w-full max-w-xs rounded-lg border border-red-300 bg-white px-3 py-2 text-base text-ivory outline-none focus:border-red-600"
          />
          {state?.error && (
            <p role="alert" className="mt-2 text-sm font-semibold text-red-700">
              {state.error}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button type="submit" disabled={pending} className="rounded-full bg-red-700 px-5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-60">
              {pending ? "Deleting…" : "Permanently delete my account"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="px-2 py-2.5 text-sm text-muted hover:text-ivory">
              Keep my account
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
