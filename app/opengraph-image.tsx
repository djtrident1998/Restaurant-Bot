import { ImageResponse } from "next/og";
import { CREATOR_NAME, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// The picture shown when the link is shared (LinkedIn, WhatsApp, X, Slack…). Generated once at build time.
export const alt = "Spice Route — the AI waiter you can trust";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PROOFS = ["Grounded in the real menu", "Totals calculated in code", "Split the bill with friends"];

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #1b0d0b 0%, #3a1410 55%, #b81f2d 130%)",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "linear-gradient(135deg, #ff7a3d, #b81f2d)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            S
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1 }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 88, fontWeight: 800, lineHeight: 1.02, letterSpacing: -3 }}>{SITE_TAGLINE}</div>
          <div style={{ marginTop: 24, fontSize: 32, color: "#f6d9d3" }}>Order North Indian food by chat or voice. No invented dishes. No wrong totals.</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", gap: 16 }}>
            {PROOFS.map((p) => (
              <div key={p} style={{ display: "flex", padding: "12px 22px", borderRadius: 999, background: "rgba(255,255,255,0.14)", fontSize: 26, fontWeight: 600 }}>
                {p}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", fontSize: 28, color: "#f6d9d3" }}>Designed & built by {CREATOR_NAME}</div>
        </div>
      </div>
    ),
    size,
  );
}
