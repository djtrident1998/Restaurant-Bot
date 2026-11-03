"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { logout } from "@/app/actions/auth";
import { Brand } from "./Brand";
import { NAME_COOKIE } from "@/lib/auth/nameCookie";

/**
 * The landing page's top bar. Unlike SiteHeader it reads no server cookies, so the landing page stays fully static
 * (served from the CDN, no function run per visitor — important when a post sends a crowd). The first name comes from a
 * display-only cookie; real authorisation always uses the signed, HttpOnly session cookie.
 */
function readName(): string | null {
  const m = document.cookie.split("; ").find((c) => c.startsWith(`${NAME_COOKIE}=`));
  if (!m) return null;
  try {
    return decodeURIComponent(m.slice(NAME_COOKIE.length + 1));
  } catch {
    return null; // malformed cookie
  }
}
const noSubscribe = () => () => {};

export function LandingHeader() {
  // Server render and hydration use `null` (signed-out look); the browser then shows the real name.
  const name = useSyncExternalStore(noSubscribe, readName, () => null);

  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Brand />
        <nav className="flex shrink-0 items-center gap-1 whitespace-nowrap text-xs min-[420px]:gap-2 min-[420px]:text-sm sm:gap-3">
          <Link href="/order" className="hidden px-2 text-muted transition hover:text-gold-soft sm:inline">
            Menu &amp; Order
          </Link>
          <Link href="/book" className="hidden px-2 text-muted transition hover:text-gold-soft sm:inline">
            Book a table
          </Link>
          <Link href="/about" className="hidden px-2 text-muted transition hover:text-gold-soft sm:inline">
            About
          </Link>
          {name ? (
            <>
              <Link href="/account" className="btn-ghost px-3.5 py-2" title="Your account and past orders">
                <span className="hidden sm:inline">Hi, </span>
                <span className="inline-block max-w-[6.5rem] truncate align-bottom">{name}</span>
              </Link>
              <form action={logout}>
                <button type="submit" className="px-2 py-2.5 text-muted transition hover:text-gold-soft">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="px-2 py-1.5 text-ivory transition hover:text-gold-soft">
                Sign in
              </Link>
              <Link href="/signup" className="btn-gold px-3 py-1.5 text-xs min-[420px]:px-4 min-[420px]:py-2 min-[420px]:text-sm">
                <span className="min-[420px]:hidden">Join</span>
                <span className="hidden min-[420px]:inline">Create account</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
