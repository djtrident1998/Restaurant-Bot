"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login, signup } from "@/app/actions/auth";
import type { AuthFormState } from "@/lib/auth/schemas";

const field = "mt-1.5 w-full rounded-xl border border-line bg-ink px-4 py-3 text-ivory outline-none placeholder:text-muted/60 focus:border-gold";

export function AuthForm({ mode, notice }: { mode: "login" | "signup"; notice?: string }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(mode === "signup" ? signup : login, undefined);
  const fe = state?.fieldErrors;
  const isSignup = mode === "signup";
  const [showPw, setShowPw] = useState(false);

  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.error && (
        <p role="alert" className="rounded-xl border border-red-400/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {state.error}
        </p>
      )}

      {isSignup && (
        <div>
          <label htmlFor="name" className="text-sm text-gold-soft">
            Your name
          </label>
          <input id="name" name="name" autoComplete="name" placeholder="Asha Verma" className={field} aria-invalid={!!fe?.name} />
          {fe?.name && <p className="mt-1 text-sm text-red-300">{fe.name}</p>}
        </div>
      )}

      <div>
        <label htmlFor="email" className="text-sm text-gold-soft">
          Email
        </label>
        <input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" className={field} aria-invalid={!!fe?.email} />
        {fe?.email && <p className="mt-1 text-sm text-red-300">{fe.email}</p>}
      </div>

      <div>
        <label htmlFor="password" className="text-sm text-gold-soft">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPw ? "text" : "password"}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "Create a password" : "Your password"}
            className={`${field} pr-20`}
            aria-invalid={!!fe?.password}
            aria-describedby={isSignup ? "pw-hint" : undefined}
          />
          <button type="button" onClick={() => setShowPw((s) => !s)} aria-pressed={showPw} className="absolute right-2 top-1/2 mt-0.5 -translate-y-1/2 rounded-lg px-3 py-2 text-sm font-semibold text-gold-soft hover:underline">
            {showPw ? "Hide" : "Show"}
          </button>
        </div>
        {isSignup && (
          <p id="pw-hint" className="mt-1.5 text-xs text-muted">
            At least 8 characters, with a letter and a number.
          </p>
        )}
        {fe?.password && <p className="mt-1 text-sm text-red-300">{fe.password}</p>}
      </div>

      <button type="submit" disabled={pending} className="btn-gold w-full px-4 py-3 text-base">
        {pending ? "One moment…" : isSignup ? "Create my account" : "Sign in"}
      </button>

      {isSignup && (
        <p className="text-center text-xs text-muted">
          By creating an account you agree to our{" "}
          <Link href="/terms" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
            Terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="font-semibold text-gold-soft underline-offset-4 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      )}

      {notice && <p className="text-center text-xs text-muted">{notice}</p>}

      <p className="text-center text-sm text-muted">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-gold-soft underline-offset-4 hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to Spice Route?{" "}
            <Link href="/signup" className="text-gold-soft underline-offset-4 hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
