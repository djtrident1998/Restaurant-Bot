import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/auth/store";
import { submitFeedback } from "@/lib/feedback";
import { checkAuthLimit } from "@/lib/ratelimit";

// Rate (and optionally comment on) one of your own past orders. Sign-in required; the order must be yours.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ ok: false, error: "Please sign in to leave feedback." }, { status: 401 });

  if (!checkAuthLimit(`feedback:${user.id}`)) return Response.json({ ok: false, error: "Too many attempts. Please try again in a few minutes." }, { status: 429 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const result = await submitFeedback(getStore(), user.id, body);
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: result.status });
  return Response.json({ ok: true, feedback: result.feedback });
}
