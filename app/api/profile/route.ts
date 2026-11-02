import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/auth/store";
import { parseProfile } from "@/lib/profile";
import { checkWindow } from "@/lib/ratelimit";

// Save the signed-in customer's Allergen Shield profile. Only the exact expected shape is accepted.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Please sign in to save your food profile." }, { status: 401 });
  if (!checkWindow(`profile:${user.id}`, 30, 10 * 60_000)) return Response.json({ ok: false, error: "Too many changes. Please try again in a few minutes." }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const p = parseProfile(body);
  if (!p.ok) return Response.json({ ok: false, error: p.error }, { status: 400 });

  const saved = await getStore().updateUser(user.id, (u) => {
    u.profile = { vegOnly: p.profile.vegOnly, avoid: [...p.profile.avoid] };
    return true;
  });
  if (!saved) return Response.json({ ok: false, error: "We couldn't find your account." }, { status: 404 });
  return Response.json({ ok: true, profile: p.profile });
}
