import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/prices/refresh/route";
import { prisma } from "@/src/lib/db";

const runLivePolygonTests =
  process.env.POLYGON_LIVE_TESTS === "1" && Boolean(process.env.POLYGON_API_KEY);

const describeLive = runLivePolygonTests ? describe : describe.skip;

describeLive("polygon live integration", () => {
  it(
    "fetches real daily bars and upserts PricePoint rows",
    async () => {
      await prisma.instrument.create({
        data: {
          symbol: "SPY",
          name: "SPDR S&P 500 ETF Trust",
          kind: "ETF",
          currency: "USD",
        },
      });

      const req = new Request("http://localhost/api/prices/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbols: ["SPY"],
          from: "2025-01-02",
          to: "2025-01-10",
        }),
      });

      const res = await POST(req);
      expect(res.status).toBe(200);

      const payload = (await res.json()) as {
        data: {
          requestedSymbols: string[];
          processedSymbols: string[];
          missingSymbols: string[];
          pointsUpserted: number;
        };
      };

      expect(payload.data.requestedSymbols).toContain("SPY");
      expect(payload.data.processedSymbols).toContain("SPY");
      expect(payload.data.missingSymbols).not.toContain("SPY");
      expect(payload.data.pointsUpserted).toBeGreaterThan(0);

      const stored = await prisma.pricePoint.count({
        where: {
          source: "polygon",
        },
      });
      expect(stored).toBeGreaterThan(0);
    },
    60_000,
  );
});

