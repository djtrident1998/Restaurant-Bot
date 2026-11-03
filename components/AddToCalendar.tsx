"use client";

import { bookingIcs, type BookingRef } from "@/lib/booking";

/** Downloads a calendar file for the booking, so it lands in the customer's own calendar (with their own reminders). */
export function AddToCalendar({ booking, className = "btn-ghost px-4 py-2 text-sm" }: { booking: BookingRef; className?: string }) {
  function download() {
    const blob = new Blob([bookingIcs(booking)], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spice-route-${booking.id}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <button type="button" onClick={download} className={className}>
      📅 Add to calendar
    </button>
  );
}
