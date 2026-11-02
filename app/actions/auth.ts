"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { dummyHash, hashPassword, verifyPassword } from "@/lib/auth/password";
import { loginSchema, signupSchema, type AuthFormState } from "@/lib/auth/schemas";
import { endSession, startSession } from "@/lib/auth/session";
import { getStore, userIdFor } from "@/lib/auth/store";
import { checkAuthLimit } from "@/lib/ratelimit";

async function clientIp(): Promise<string> {
  return (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]): NonNullable<AuthFormState>["fieldErrors"] {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0]);
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({ name: formData.get("name"), email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const { name, email, password } = parsed.data;

  if (!checkAuthLimit(`signup:${await clientIp()}`)) return { error: TOO_MANY };

  const created = await getStore().create({
    id: userIdFor(email),
    name,
    email,
    passwordHash: await hashPassword(password),
    createdAt: Date.now(),
    orders: [],
  });
  if (!created) return { fieldErrors: { email: "An account with this email already exists. Try signing in." } };

  await startSession(userIdFor(email), name);
  redirect("/order");
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error.issues) };
  const { email, password } = parsed.data;

  if (!checkAuthLimit(`login:${await clientIp()}:${email}`)) return { error: TOO_MANY };

  const user = await getStore().findByEmail(email);
  // Same work and same message whether the email exists or not, so the form can't be used to find accounts.
  const ok = await verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !ok) return { error: "Incorrect email or password." };

  await startSession(user.id, user.name);
  redirect("/order");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/");
}
