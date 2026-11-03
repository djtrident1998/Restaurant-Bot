import { cookies } from "next/headers";
import { cache } from "react";
import { createToken, getSessionSecret, SESSION_DAYS, verifyToken } from "./token";
import { getStore, type OrderRecord, type UserStore } from "./store";
import { NAME_COOKIE } from "./nameCookie";
import { normalizeProfile, type Profile } from "../profile";
import type { BookingRef } from "../booking";

export const SESSION_COOKIE = "sr_session";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  profile: Profile;
}

export async function startSession(userId: string, name = ""): Promise<void> {
  const jar = await cookies();
  const opts = { secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: SESSION_DAYS * 86_400 };
  jar.set(SESSION_COOKIE, createToken(userId, getSessionSecret()), { ...opts, httpOnly: true });
  // Display-only first name for the static landing page (readable by script on purpose; never trusted for access).
  const first = name.trim().split(/\s+/)[0]?.slice(0, 30);
  if (first) jar.set(NAME_COOKIE, encodeURIComponent(first), { ...opts, httpOnly: false });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(NAME_COOKIE);
}

export interface Account {
  user: CurrentUser;
  orders: OrderRecord[];
  bookings: BookingRef[];
}

/**
 * Verify the session token and load the account. A storage hiccup (network blip, timeout) must not take a whole page
 * down: it is logged and the visitor is treated as signed out for this request, which is always the SAFE direction
 * (nothing that needs a signed-in customer can happen without a loaded account).
 */
export async function resolveAccount(token: string | undefined, secret: string, store: UserStore): Promise<Account | null> {
  const payload = verifyToken(token, secret);
  if (!payload) return null;
  try {
    const u = await store.findById(payload.uid);
    if (!u) return null;
    return { user: { id: u.id, name: u.name, email: u.email, profile: normalizeProfile(u.profile) }, orders: u.orders ?? [], bookings: u.bookings ?? [] };
  } catch (e) {
    console.error("[session] could not load account", String(e).slice(0, 160));
    return null;
  }
}

// One storage read per page request: the page, the header and any other server component share this result
// instead of each reading the account again (a signed-in /order page used to read it three times in a row).
const loadAccount = cache((token: string | undefined) => resolveAccount(token, getSessionSecret(), getStore()));

async function sessionToken() {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

/** The signed-in user, or null. Verifies the cookie signature and expiry, then loads the account. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await loadAccount(await sessionToken()))?.user ?? null;
}

/** The signed-in user together with their orders, from the same single read. */
export async function getCurrentAccount(): Promise<Account | null> {
  return loadAccount(await sessionToken());
}
