import { blobCas, sameVersion, sdkBackend } from "@/lib/blobCas";
import { checkWindow } from "@/lib/ratelimit";

export const dynamic = "force-dynamic";

const shape = (e?: string) => (!e ? "none" : e.startsWith("W/") ? "weak" : e.startsWith('"') ? "quoted" : "plain");

// A storage self-check: does a safe, conditional read-modify-write against the real Blob store work? It touches only a
// scratch file (diag/cas-check.json), returns no customer data, and is rate-limited. Useful for uptime checks and for
// diagnosing "could not save" problems.
export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkWindow(`storage-check:${ip}`, 5, 60_000)) return Response.json({ ok: false, error: "Too many checks. Please wait a minute." }, { status: 429 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ ok: true, storage: "not-blob" });

  const path = "diag/cas-check.json";
  try {
    const writes = await blobCas().update<{ n: number }, number>(path, (cur) => ({ write: true, next: { n: (cur?.n ?? 0) + 1 }, result: (cur?.n ?? 0) + 1 }));
    const h = await sdkBackend.head(path);
    const g = await sdkBackend.get(path);
    return Response.json({ ok: true, storage: "blob", casWorks: true, writes, headEtag: shape(h?.etag), readEtag: shape(g?.etag), versionsAgree: !!(h && g && sameVersion(h.etag, g.etag)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return Response.json({ ok: false, storage: "blob", casWorks: false, error: String((e as Error)?.message ?? e).slice(0, 140) }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
