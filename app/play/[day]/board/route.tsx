import { ImageResponse } from "next/og";
import { SOCIAL } from "@/config";
import { COLS, EMPTY, SEEDS, dailyBoard, isOffset, parseDay } from "@/lib/bloom-pop";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const W = 1200;
const H = 675;
const R = 36;

/** The day's starting field as an SVG: the same hex grid and seed colours as the game. */
function boardSvg(day: string): { svg: string; width: number; height: number } {
  const g = dailyBoard(day);
  const rowH = R * Math.sqrt(3);
  const width = COLS * 2 * R + R;
  const height = 2 * R + (g.cells.length - 1) * rowH;
  const circles = g.cells.flatMap((row, r) =>
    row.flatMap((kind, c) => {
      if (kind === EMPTY) return [];
      const cx = R + c * 2 * R + (isOffset(g, r) ? R : 0);
      const cy = R + r * rowH;
      return [
        `<circle cx="${cx}" cy="${cy}" r="${R - 2}" fill="${SEEDS[kind].fill}"/>`,
        `<circle cx="${cx - R * 0.32}" cy="${cy - R * 0.36}" r="${R * 0.28}" fill="rgba(255,255,255,0.3)"/>`,
      ];
    }),
  );
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${circles.join("")}</svg>`, width, height };
}

/**
 * GET /play/<day>/board: a picture of that day's Bloom Pop field (1200 x 675, 16:9 for X), used by
 * the daily auto-post. Only days that have started exist, so nobody can peek at tomorrow's field.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ day: string }> }) {
  const day = parseDay((await params).day);
  if (!day) return new Response("Not found", { status: 404 });
  const board = boardSvg(day);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "linear-gradient(180deg, #dcedf5 0%, #eaf2ea 55%, #f7f3e3 100%)", padding: "48px 64px", fontFamily: "sans-serif", color: "#1e2a1c" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#1f5a22" }}>Bloom Pop</div>
          <div style={{ display: "flex", fontSize: 26, color: "#8a5a00", letterSpacing: 3, textTransform: "uppercase" }}>Field of {formatDate(`${day}T00:00:00Z`)}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`data:image/svg+xml;base64,${Buffer.from(board.svg).toString("base64")}`} width={board.width} height={board.height} alt="" />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontSize: 32, color: "#56634f" }}>Same field for everyone today. Match three to bloom.</div>
          <div style={{ display: "flex", fontSize: 26, color: "#56634f" }}>{SOCIAL.xHandle}</div>
        </div>
      </div>
    ),
    { width: W, height: H, headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
