import { verifyPassword } from "./auth/password";
import type { UserRecord, UserStore } from "./auth/store";
import { releaseAndScrubBookings } from "./bookingService";
import type { BookingStore } from "./bookings/store";

// Your data, your control (GDPR / India's DPDP Act style rights): see everything we hold, and delete it.

/** Everything stored about the customer, as a plain object. The password hash is deliberately left out. */
export function exportAccount(user: UserRecord, now = Date.now()) {
  const { passwordHash: _omit, ...rest } = user;
  void _omit;
  return {
    exportedAt: new Date(now).toISOString(),
    note: "This is all the data Spice Route stores about you. Your password is never stored, only a salted one-way hash, which is not included here.",
    account: rest,
  };
}

export type DeleteResult = { ok: true } | { ok: false; error: string };

/**
 * Permanently delete the signed-in customer's account. Requires the current password, so a stolen session or an
 * unattended screen can't wipe an account. The caller passes the user id from the verified session cookie.
 */
export async function deleteAccount(store: UserStore, userId: string, password: unknown, bookings?: BookingStore): Promise<DeleteResult> {
  if (typeof password !== "string" || !password) return { ok: false, error: "Please enter your password to confirm." };
  const user = await store.findById(userId);
  if (!user) return { ok: false, error: "We couldn't find your account." };
  if (!(await verifyPassword(password, user.passwordHash))) return { ok: false, error: "That password isn't correct." };
  // Release held tables and scrub personal details from the shared booking files before the account itself goes.
  if (bookings && user.bookings?.length) await releaseAndScrubBookings(bookings, user.bookings, userId);
  const removed = await store.deleteUser(userId);
  return removed ? { ok: true } : { ok: false, error: "We couldn't delete your account. Please try again." };
}
