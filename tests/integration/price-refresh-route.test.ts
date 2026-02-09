import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/prices/refresh/route";
import { prisma } from "@/src/lib/db";

describe("/api/prices/refresh route", () => {
  it("returns 400 when from > to", async () => {
    const res = await POST(
      new Request("http://localhost/api/prices/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: "2026-01-10", to: "2026-01-01" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 200 with no symbols and no matching instruments", async () => {
    const res = await POST(
      new Request("http://localhost/api/prices/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { data: { pointsUpserted: number } };
    expect(payload.data.pointsUpserted).toBe(0);
  });

  it("returns 400 when polygon key is missing and refresh is requested", async () => {
    await prisma.instrument.create({
      data: {
        symbol: "SPY",
        name: "SPDR S&P 500 ETF",
        kind: "ETF",
        currency: "USD",
      },
    });
    const original = process.env.POLYGON_API_KEY;
    delete process.env.POLYGON_API_KEY;

    const res = await POST(
      new Request("http://localhost/api/prices/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbols: ["SPY"],
          from: "2026-01-01",
          to: "2026-01-02",
        }),
      }),
    );
    expect(res.status).toBe(400);

    if (original) {
      process.env.POLYGON_API_KEY = original;
    }
  });
});

