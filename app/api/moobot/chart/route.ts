import { getMooBotChart } from "@/lib/moobot";
import { CHART_RANGES, type ChartRange } from "@/lib/sources/orbio-api";

export const dynamic = "force-dynamic";

/**
 * The $MOOBOT price chart, for the browser: {status: "off"} until the contract is verified, then
 * Orbio's price history for ?range=1h|4h|1d (default 1h). The browser never calls Orbio itself.
 */
export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get("range") ?? "1h";
  if (!(CHART_RANGES as readonly string[]).includes(asked)) {
    return Response.json({ error: `range must be one of ${CHART_RANGES.join(", ")}` }, { status: 400 });
  }
  return Response.json(await getMooBotChart(asked as ChartRange), { headers: { "Cache-Control": "no-store" } });
}
