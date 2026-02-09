import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/overview/route";
import { prisma } from "@/src/lib/db";

describe("/api/overview route", () => {
  it("scopes overview by accountId filter", async () => {
    const accountA = await prisma.account.create({
      data: { name: "A", baseCurrency: "USD" },
    });
    const accountB = await prisma.account.create({
      data: { name: "B", baseCurrency: "USD" },
    });
    const instrument = await prisma.instrument.create({
      data: { symbol: "AAPL", name: "Apple", kind: "STOCK", currency: "USD" },
    });

    await prisma.transaction.createMany({
      data: [
        {
          accountId: accountA.id,
          instrumentId: instrument.id,
          type: "BUY",
          tradeDate: new Date("2026-01-10"),
          quantity: 1,
          price: 100,
          amount: 100,
          feeAmount: 0,
        },
        {
          accountId: accountB.id,
          instrumentId: instrument.id,
          type: "BUY",
          tradeDate: new Date("2026-01-10"),
          quantity: 3,
          price: 100,
          amount: 300,
          feeAmount: 0,
        },
      ],
    });
    await prisma.pricePoint.create({
      data: {
        instrumentId: instrument.id,
        date: new Date("2026-01-10"),
        close: 100,
        source: "manual",
      },
    });

    const res = await GET(
      new Request(`http://localhost/api/overview?asOfDate=2026-01-10&accountId=${accountA.id}`),
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      data: { totals: { marketValue: number; cashValue: number }; holdings: Array<{ accountId: string }> };
    };
    expect(payload.data.totals.marketValue).toBeCloseTo(100, 6);
    expect(payload.data.totals.cashValue).toBeCloseTo(-100, 6);
    expect(payload.data.holdings.every((holding) => holding.accountId === accountA.id)).toBe(true);
  });

  it("returns totals and holdings with stale price warning fallback", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    const instrument = await prisma.instrument.create({
      data: { symbol: "AAPL", name: "Apple", kind: "STOCK", currency: "USD" },
    });

    await prisma.transaction.create({
      data: {
        accountId: account.id,
        instrumentId: instrument.id,
        type: "BUY",
        tradeDate: new Date("2026-01-10"),
        quantity: 2,
        price: 100,
        amount: 200,
        feeAmount: 0,
      },
    });
    await prisma.pricePoint.create({
      data: {
        instrumentId: instrument.id,
        date: new Date("2026-01-09"),
        close: 110,
        source: "manual",
      },
    });

    const res = await GET(new Request("http://localhost/api/overview?asOfDate=2026-01-10"));
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      data: {
        totals: { totalValue: number; marketValue: number; cashValue: number };
        holdings: Array<{ symbol: string }>;
        warnings: Array<{ code: string }>;
      };
    };

    expect(payload.data.totals.marketValue).toBeCloseTo(220, 6);
    expect(payload.data.totals.cashValue).toBeCloseTo(-200, 6);
    expect(payload.data.totals.totalValue).toBeCloseTo(20, 6);
    expect(payload.data.holdings.some((item) => item.symbol === "AAPL")).toBe(true);
    expect(payload.data.warnings.some((warning) => warning.code === "STALE_PRICE_FALLBACK")).toBe(
      true,
    );
  });

  it("returns missing price warning when no price exists", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    const instrument = await prisma.instrument.create({
      data: { symbol: "MSFT", name: "Microsoft", kind: "STOCK", currency: "USD" },
    });

    await prisma.transaction.create({
      data: {
        accountId: account.id,
        instrumentId: instrument.id,
        type: "BUY",
        tradeDate: new Date("2026-01-10"),
        quantity: 1,
        price: 100,
        amount: 100,
        feeAmount: 0,
      },
    });

    const res = await GET(new Request("http://localhost/api/overview?asOfDate=2026-01-10"));
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { data: { warnings: Array<{ code: string }> } };
    expect(payload.data.warnings.some((warning) => warning.code === "MISSING_PRICE")).toBe(true);
  });

  it("returns 400 for invalid asOfDate", async () => {
    const res = await GET(new Request("http://localhost/api/overview?asOfDate=not-a-date"));
    expect(res.status).toBe(400);
  });

  it("returns performance metrics for ytd period", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    const instrument = await prisma.instrument.create({
      data: { symbol: "QQQ", name: "QQQ", kind: "ETF", currency: "USD" },
    });

    await prisma.transaction.createMany({
      data: [
        {
          accountId: account.id,
          type: "DEPOSIT",
          tradeDate: new Date("2026-01-01"),
          amount: 1000,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          instrumentId: instrument.id,
          type: "BUY",
          tradeDate: new Date("2026-01-01"),
          quantity: 10,
          price: 100,
          amount: 1000,
          feeAmount: 0,
        },
      ],
    });
    await prisma.pricePoint.createMany({
      data: [
        {
          instrumentId: instrument.id,
          date: new Date("2026-01-01"),
          close: 100,
          source: "manual",
        },
        {
          instrumentId: instrument.id,
          date: new Date("2026-01-02"),
          close: 110,
          source: "manual",
        },
      ],
    });

    const res = await GET(
      new Request("http://localhost/api/overview?asOfDate=2026-01-02&period=ytd"),
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      data: {
        totals: { twr: number | null; mwr: number | null };
        performance: { period: { type: string } };
      };
    };
    expect(payload.data.performance.period.type).toBe("ytd");
    expect(payload.data.totals.twr).toBeCloseTo(0.1, 6);
    expect(payload.data.totals.mwr).not.toBeNull();
  });

  it("returns 400 for custom period without from/to", async () => {
    const res = await GET(
      new Request("http://localhost/api/overview?asOfDate=2026-01-10&period=custom"),
    );
    expect(res.status).toBe(400);
  });

  it("handles zero total value without NaN portfolio weights", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    const instrument = await prisma.instrument.create({
      data: { symbol: "NFLX", name: "Netflix", kind: "STOCK", currency: "USD" },
    });

    await prisma.transaction.create({
      data: {
        accountId: account.id,
        instrumentId: instrument.id,
        type: "BUY",
        tradeDate: new Date("2026-01-10"),
        quantity: 1,
        price: 100,
        amount: 100,
        feeAmount: 0,
      },
    });
    await prisma.pricePoint.create({
      data: {
        instrumentId: instrument.id,
        date: new Date("2026-01-10"),
        close: 100,
        source: "manual",
      },
    });

    const res = await GET(new Request("http://localhost/api/overview?asOfDate=2026-01-10"));
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      data: { totals: { totalValue: number }; holdings: Array<{ portfolioWeightPct: number }> };
    };
    expect(payload.data.totals.totalValue).toBeCloseTo(0, 6);
    for (const holding of payload.data.holdings) {
      expect(Number.isFinite(holding.portfolioWeightPct)).toBe(true);
    }
  });
});
