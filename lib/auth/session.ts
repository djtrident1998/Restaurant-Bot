import { cookies } from "next/headers";
import { createToken, getSessionSecret, SESSION_DAYS, verifyToken } from "./token";
import { getStore } from "./store";

export const SESSION_COOKIE = "sr_session";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
}

export async function startSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, createToken(userId, getSessionSecret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Verifies the cookie signature and expiry, then loads the account. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const payload = verifyToken(token, getSessionSecret());
  if (!payload) return null;
  const user = await getStore().findById(payload.uid);
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}
