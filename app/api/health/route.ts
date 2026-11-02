// A cheap "is it up?" endpoint for uptime monitors. It reveals nothing sensitive: no keys, no counts, no user data.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, service: "spice-route", time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
