import { describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/valuations/refresh/route";
import { prisma } from "@/src/lib/db";

describe("/api/valuations/refresh route", () => {
  it("returns status payload even when never run", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      data: {
        lastPriceFetchedAt: string | null;
        lastValuationMaterializedAt: string | null;
        lastValuationDate: string | null;
      };
    };
    expect(payload.data.lastPriceFetchedAt).toBeNull();
    expect(payload.data.lastValuationMaterializedAt).toBeNull();
    expect(payload.data.lastValuationDate).toBeNull();
  });

  it("runs full refresh when requested symbols do not match tracked instruments", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    await prisma.transaction.create({
      data: {
        accountId: account.id,
        type: "DEPOSIT",
        tradeDate: new Date("2026-01-10"),
        amount: 100,
        feeAmount: 0,
      },
    });

    const res = await POST(
      new Request("http://localhost/api/valuations/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbols: ["NO_SUCH_SYMBOL"],
          from: "2026-01-10",
          to: "2026-01-10",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      data: {
        price: { pointsUpserted: number; processedSymbols: string[]; missingSymbols: string[] };
        valuation: { rowsUpserted: number };
        status: { lastValuationMaterializedAt: string | null; lastValuationDate: string | null };
      };
    };

    expect(payload.data.price.pointsUpserted).toBe(0);
    expect(payload.data.price.processedSymbols).toHaveLength(0);
    expect(payload.data.price.missingSymbols).toContain("NO_SUCH_SYMBOL");
    expect(payload.data.valuation.rowsUpserted).toBeGreaterThan(0);
    expect(payload.data.status.lastValuationMaterializedAt).not.toBeNull();
    expect(payload.data.status.lastValuationDate).toBe("2026-01-10");
  });

  it("returns 400 when polygon key is missing and active symbols require refresh", async () => {
    await prisma.instrument.create({
      data: {
        symbol: "SPY_REFRESH",
        name: "SPY Refresh",
        kind: "ETF",
        currency: "USD",
      },
    });

    const original = process.env.POLYGON_API_KEY;
    delete process.env.POLYGON_API_KEY;

    const res = await POST(
      new Request("http://localhost/api/valuations/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: "2026-01-10", to: "2026-01-10" }),
      }),
    );

    expect(res.status).toBe(400);

    if (original) {
      process.env.POLYGON_API_KEY = original;
    }
  });
});
