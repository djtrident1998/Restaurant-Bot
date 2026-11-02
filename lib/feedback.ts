import { z } from "zod";
import type { OrderFeedback, UserStore } from "./auth/store";
import { MAX_COMMENT } from "./feedbackConstants";

export { MAX_COMMENT };

export const feedbackSchema = z.object({
  orderId: z.string().trim().min(1).max(30).regex(/^[A-Za-z0-9-]+$/, "Invalid order id."),
  rating: z.number().int("Please choose a whole number of stars.").min(1, "Please choose 1 to 5 stars.").max(5, "Please choose 1 to 5 stars."),
  comment: z.string().max(MAX_COMMENT, `Please keep your comment under ${MAX_COMMENT} characters.`).optional().default(""),
});

export type FeedbackResult = { ok: true; feedback: OrderFeedback } | { ok: false; status: 400 | 404; error: string };

/**
 * Validate and save a rating for one of the signed-in customer's own orders. The caller passes the user id from the
 * verified session; an order id belonging to someone else simply isn't found (404), so nothing leaks or gets changed.
 */
export async function submitFeedback(store: UserStore, userId: string, raw: unknown, now = Date.now()): Promise<FeedbackResult> {
  const p = feedbackSchema.safeParse(raw);
  if (!p.success) return { ok: false, status: 400, error: p.error.issues[0]?.message ?? "Invalid feedback." };
  // Control characters are stripped; markup is NOT interpreted anywhere (React renders it as text), so it stays harmless.
  const comment = p.data.comment.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  const feedback: OrderFeedback = { rating: p.data.rating, comment, at: now };
  const saved = await store.setFeedback(userId, p.data.orderId, feedback);
  return saved ? { ok: true, feedback } : { ok: false, status: 404, error: "We couldn't find that order on your account." };
}
