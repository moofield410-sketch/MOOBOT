import { ImageResponse } from "next/og";
import { parseShare } from "@/lib/bloom-pop";
import { formatDate } from "@/lib/format";
import { SOCIAL } from "@/config";

export const alt = "A Bloom Pop score card from Moofield";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const SEEDS = ["#5daa4a", "#f2b705", "#4fa3d9", "#8a5bb8", "#e0654f"];

/** The score card shown when a Bloom Pop score is shared on X (or anywhere with link previews). */
export default async function Image({ params }: { params: Promise<{ day: string; score: string }> }) {
  const { day, score } = await params;
  const s = parseShare(day, score);
  const value = s ? s.score.toLocaleString("en-US") : "Bloom Pop";
  const field = s ? `Field of ${formatDate(`${s.day}T00:00:00Z`)}` : "A new field every day";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(180deg, #dcedf5 0%, #f7f3e3 70%)", padding: 64, fontFamily: "sans-serif", color: "#1e2a1c" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 700, color: "#1f5a22" }}>Moofield · Bloom Pop</div>
          <div style={{ display: "flex", gap: 14 }}>
            {SEEDS.map((c) => (
              <div key={c} style={{ width: 34, height: 34, borderRadius: 999, background: c }} />
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 30, color: "#8a5a00", letterSpacing: 4, textTransform: "uppercase" }}>{field}</div>
          <div style={{ display: "flex", fontSize: s ? 190 : 120, fontWeight: 800, color: "#1f5a22", lineHeight: 1.05 }}>{value}</div>
          <div style={{ display: "flex", fontSize: 36, color: "#56634f" }}>Help MooBot plant the Field. Can you beat it?</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#56634f" }}>
          <div style={{ display: "flex" }}>Same field for everyone, every day</div>
          <div style={{ display: "flex" }}>{SOCIAL.xHandle}</div>
        </div>
      </div>
    ),
    size,
  );
}
