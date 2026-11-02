import { cookies } from "next/headers";
import { createToken, getSessionSecret, SESSION_DAYS, verifyToken } from "./token";
import { getStore } from "./store";
import { NAME_COOKIE } from "./nameCookie";
import { normalizeProfile, type Profile } from "../profile";

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

/** The signed-in user, or null. Verifies the cookie signature and expiry, then loads the account. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = verifyToken(token, getSessionSecret());
  if (!payload) return null;
  const user = await getStore().findById(payload.uid);
  return user ? { id: user.id, name: user.name, email: user.email, profile: normalizeProfile(user.profile) } : null;
}
