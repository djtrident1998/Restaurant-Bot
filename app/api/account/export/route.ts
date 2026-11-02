import { getCurrentUser } from "@/lib/auth/session";
import { getStore } from "@/lib/auth/store";
import { exportAccount } from "@/lib/account";

// Download everything we store about YOU as a JSON file. Sign-in required; never includes the password hash.
export async function GET() {
  const current = await getCurrentUser();
  if (!current) return Response.json({ error: "Please sign in to download your data." }, { status: 401 });
  const record = await getStore().findById(current.id);
  if (!record) return Response.json({ error: "We couldn't find your account." }, { status: 404 });
  return new Response(JSON.stringify(exportAccount(record), null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="spice-route-my-data.json"',
      "Cache-Control": "private, no-store",
    },
  });
}
