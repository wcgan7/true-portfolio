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

  it("returns 400 for invalid mode", async () => {
    const res = await GET(new Request("http://localhost/api/overview?mode=invalid"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid assetKind", async () => {
    const res = await GET(new Request("http://localhost/api/overview?assetKind=BOND"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid currency code", async () => {
    const res = await GET(new Request("http://localhost/api/overview?currency=USDX"));
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

  it("flattens ETF exposure in lookthrough mode and aggregates overlap", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    const etf = await prisma.instrument.create({
      data: { symbol: "SPY_LT", name: "SPY LT", kind: "ETF", currency: "USD" },
    });
    const aapl = await prisma.instrument.create({
      data: { symbol: "AAPL_LT", name: "Apple LT", kind: "STOCK", currency: "USD" },
    });

    await prisma.transaction.createMany({
      data: [
        {
          accountId: account.id,
          type: "DEPOSIT",
          tradeDate: new Date("2026-01-10"),
          amount: 150,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          instrumentId: etf.id,
          type: "BUY",
          tradeDate: new Date("2026-01-10"),
          quantity: 1,
          price: 100,
          amount: 100,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          instrumentId: aapl.id,
          type: "BUY",
          tradeDate: new Date("2026-01-10"),
          quantity: 1,
          price: 50,
          amount: 50,
          feeAmount: 0,
        },
      ],
    });
    await prisma.pricePoint.createMany({
      data: [
        { instrumentId: etf.id, date: new Date("2026-01-10"), close: 100, source: "manual" },
        { instrumentId: aapl.id, date: new Date("2026-01-10"), close: 50, source: "manual" },
      ],
    });
    await prisma.etfConstituent.createMany({
      data: [
        {
          etfInstrumentId: etf.id,
          constituentSymbol: "AAPL_LT",
          weight: 0.5,
          asOfDate: new Date("2026-01-10"),
          source: "manual",
        },
        {
          etfInstrumentId: etf.id,
          constituentSymbol: "MSFT_LT",
          weight: 0.4,
          asOfDate: new Date("2026-01-10"),
          source: "manual",
        },
      ],
    });

    const res = await GET(
      new Request("http://localhost/api/overview?asOfDate=2026-01-10&mode=lookthrough"),
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      data: {
        mode: string;
        lookThrough: {
          coveragePct: number;
          uncoveredEtfValue: number;
          staleness: Array<{ etfSymbol: string; asOfDate: string | null }>;
        } | null;
        holdings: Array<{ symbol: string; marketValue: number }>;
      };
    };

    expect(payload.data.mode).toBe("lookthrough");
    expect(payload.data.lookThrough).not.toBeNull();

    const aaplHolding = payload.data.holdings.find((h) => h.symbol === "AAPL_LT");
    const msftHolding = payload.data.holdings.find((h) => h.symbol === "MSFT_LT");
    const unmapped = payload.data.holdings.find((h) => h.symbol === "UNMAPPED_ETF_EXPOSURE");

    expect(aaplHolding).toBeDefined();
    expect(msftHolding).toBeDefined();
    expect(unmapped).toBeDefined();
    expect(aaplHolding!.marketValue).toBeCloseTo(100, 6); // 50 direct + 50 look-through
    expect(msftHolding!.marketValue).toBeCloseTo(40, 6);
    expect(unmapped!.marketValue).toBeCloseTo(10, 6);
    expect(payload.data.lookThrough!.coveragePct).toBeCloseTo(90, 6);
    expect(payload.data.lookThrough!.uncoveredEtfValue).toBeCloseTo(10, 6);
    expect(payload.data.lookThrough!.staleness[0].etfSymbol).toBe("SPY_LT");
  });

  it("creates uncovered ETF bucket and warning when no constituents exist", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    const etf = await prisma.instrument.create({
      data: { symbol: "QQQ_LT", name: "QQQ LT", kind: "ETF", currency: "USD" },
    });
    await prisma.transaction.createMany({
      data: [
        {
          accountId: account.id,
          type: "DEPOSIT",
          tradeDate: new Date("2026-01-10"),
          amount: 100,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          instrumentId: etf.id,
          type: "BUY",
          tradeDate: new Date("2026-01-10"),
          quantity: 1,
          price: 100,
          amount: 100,
          feeAmount: 0,
        },
      ],
    });
    await prisma.pricePoint.create({
      data: { instrumentId: etf.id, date: new Date("2026-01-10"), close: 100, source: "manual" },
    });

    const res = await GET(
      new Request("http://localhost/api/overview?asOfDate=2026-01-10&mode=lookthrough"),
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      data: {
        holdings: Array<{ symbol: string; marketValue: number }>;
        warnings: Array<{ code: string }>;
        lookThrough: { coveragePct: number };
      };
    };

    expect(payload.data.holdings.some((h) => h.symbol === "UNMAPPED_ETF_EXPOSURE")).toBe(true);
    expect(
      payload.data.warnings.some((warning) => warning.code === "ETF_LOOKTHROUGH_UNAVAILABLE"),
    ).toBe(true);
    expect(payload.data.lookThrough.coveragePct).toBeCloseTo(0, 6);
  });

  it("emits negative cash warning when account cash is below zero", async () => {
    const account = await prisma.account.create({
      data: { name: "Margin-ish", baseCurrency: "USD" },
    });
    const instrument = await prisma.instrument.create({
      data: { symbol: "TSLA_NEG", name: "TSLA NEG", kind: "STOCK", currency: "USD" },
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
      data: { instrumentId: instrument.id, date: new Date("2026-01-10"), close: 100, source: "manual" },
    });

    const res = await GET(new Request("http://localhost/api/overview?asOfDate=2026-01-10"));
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { data: { warnings: Array<{ code: string }> } };
    expect(payload.data.warnings.some((warning) => warning.code === "NEGATIVE_CASH")).toBe(true);
  });

  it("persists warning lifecycle idempotently and resolves cleared warnings", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    const instrument = await prisma.instrument.create({
      data: { symbol: "AMD_WARN", name: "AMD WARN", kind: "STOCK", currency: "USD" },
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

    const first = await GET(new Request("http://localhost/api/overview?asOfDate=2026-01-10"));
    expect(first.status).toBe(200);
    const second = await GET(new Request("http://localhost/api/overview?asOfDate=2026-01-10"));
    expect(second.status).toBe(200);

    const activeWarnings = await prisma.warningEvent.findMany({
      where: { code: "MISSING_PRICE" },
      orderBy: { createdAt: "asc" },
    });
    expect(activeWarnings).toHaveLength(1);
    expect(activeWarnings[0].resolvedAt).toBeNull();
    expect(activeWarnings[0].lastSeenAt.toISOString().slice(0, 10)).toBe("2026-01-10");

    await prisma.pricePoint.create({
      data: { instrumentId: instrument.id, date: new Date("2026-01-10"), close: 101, source: "manual" },
    });
    const resolved = await GET(new Request("http://localhost/api/overview?asOfDate=2026-01-10"));
    expect(resolved.status).toBe(200);

    const resolvedWarning = await prisma.warningEvent.findFirst({
      where: { code: "MISSING_PRICE" },
      orderBy: { createdAt: "asc" },
    });
    expect(resolvedWarning).not.toBeNull();
    expect(resolvedWarning!.resolvedAt?.toISOString().slice(0, 10)).toBe("2026-01-10");
  });

  it("returns classification breakdowns with unclassified exposure warnings", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    const classified = await prisma.instrument.create({
      data: {
        symbol: "META_CLASS",
        name: "Meta Class",
        kind: "STOCK",
        currency: "USD",
        metadataJson: {
          country: "United States",
          sector: "Technology",
          industry: "Internet",
        },
      },
    });
    const unclassified = await prisma.instrument.create({
      data: {
        symbol: "NO_META",
        name: "No Meta",
        kind: "STOCK",
        currency: "USD",
      },
    });

    await prisma.transaction.createMany({
      data: [
        {
          accountId: account.id,
          type: "DEPOSIT",
          tradeDate: new Date("2026-01-10"),
          amount: 200,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          instrumentId: classified.id,
          type: "BUY",
          tradeDate: new Date("2026-01-10"),
          quantity: 1,
          price: 100,
          amount: 100,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          instrumentId: unclassified.id,
          type: "BUY",
          tradeDate: new Date("2026-01-10"),
          quantity: 1,
          price: 100,
          amount: 100,
          feeAmount: 0,
        },
      ],
    });
    await prisma.pricePoint.createMany({
      data: [
        { instrumentId: classified.id, date: new Date("2026-01-10"), close: 100, source: "manual" },
        { instrumentId: unclassified.id, date: new Date("2026-01-10"), close: 100, source: "manual" },
      ],
    });

    const res = await GET(new Request("http://localhost/api/overview?asOfDate=2026-01-10"));
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      data: {
        classifications: {
          byCountry: Array<{ key: string; marketValue: number }>;
          bySector: Array<{ key: string; marketValue: number }>;
          summaries: { country: { unclassifiedPct: number } };
        };
        warnings: Array<{ code: string; symbol: string }>;
      };
    };

    expect(payload.data.classifications.byCountry.some((bucket) => bucket.key === "United States")).toBe(
      true,
    );
    expect(payload.data.classifications.byCountry.some((bucket) => bucket.key === "UNCLASSIFIED")).toBe(
      true,
    );
    expect(payload.data.classifications.bySector.some((bucket) => bucket.key === "Technology")).toBe(
      true,
    );
    expect(payload.data.classifications.summaries.country.unclassifiedPct).toBeGreaterThan(0);
    expect(
      payload.data.warnings.some(
        (warning) =>
          warning.code === "UNCLASSIFIED_EXPOSURE" && warning.symbol === "UNCLASSIFIED_COUNTRY",
      ),
    ).toBe(true);
  });

  it("computes look-through classification using constituent symbol metadata", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    const etf = await prisma.instrument.create({
      data: { symbol: "LOOK_CLASS_ETF", name: "Look Class ETF", kind: "ETF", currency: "USD" },
    });
    await prisma.instrument.create({
      data: {
        symbol: "CONSTIT_META",
        name: "Constituent Meta",
        kind: "STOCK",
        currency: "USD",
        metadataJson: {
          country: "Japan",
          sector: "Industrials",
          industry: "Automation",
        },
      },
    });

    await prisma.transaction.createMany({
      data: [
        {
          accountId: account.id,
          type: "DEPOSIT",
          tradeDate: new Date("2026-01-10"),
          amount: 100,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          instrumentId: etf.id,
          type: "BUY",
          tradeDate: new Date("2026-01-10"),
          quantity: 1,
          price: 100,
          amount: 100,
          feeAmount: 0,
        },
      ],
    });
    await prisma.pricePoint.create({
      data: { instrumentId: etf.id, date: new Date("2026-01-10"), close: 100, source: "manual" },
    });
    await prisma.etfConstituent.create({
      data: {
        etfInstrumentId: etf.id,
        constituentSymbol: "CONSTIT_META",
        weight: 1,
        asOfDate: new Date("2026-01-10"),
        source: "manual",
      },
    });

    const res = await GET(
      new Request("http://localhost/api/overview?asOfDate=2026-01-10&mode=lookthrough"),
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      data: {
        classifications: {
          byCountry: Array<{ key: string; marketValue: number }>;
          bySector: Array<{ key: string; marketValue: number }>;
          byIndustry: Array<{ key: string; marketValue: number }>;
        };
      };
    };

    expect(payload.data.classifications.byCountry.find((bucket) => bucket.key === "Japan")?.marketValue)
      .toBeCloseTo(100, 6);
    expect(
      payload.data.classifications.bySector.find((bucket) => bucket.key === "Industrials")?.marketValue,
    ).toBeCloseTo(100, 6);
    expect(
      payload.data.classifications.byIndustry.find((bucket) => bucket.key === "Automation")?.marketValue,
    ).toBeCloseTo(100, 6);
  });

  it("filters holdings by asset kind and currency", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    const stock = await prisma.instrument.create({
      data: { symbol: "FILTER_STOCK", name: "Filter Stock", kind: "STOCK", currency: "USD" },
    });
    const etf = await prisma.instrument.create({
      data: { symbol: "FILTER_ETF", name: "Filter ETF", kind: "ETF", currency: "USD" },
    });
    await prisma.transaction.createMany({
      data: [
        {
          accountId: account.id,
          type: "DEPOSIT",
          tradeDate: new Date("2026-01-10"),
          amount: 300,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          instrumentId: stock.id,
          type: "BUY",
          tradeDate: new Date("2026-01-10"),
          quantity: 1,
          price: 100,
          amount: 100,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          instrumentId: etf.id,
          type: "BUY",
          tradeDate: new Date("2026-01-10"),
          quantity: 1,
          price: 100,
          amount: 100,
          feeAmount: 0,
        },
      ],
    });
    await prisma.pricePoint.createMany({
      data: [
        { instrumentId: stock.id, date: new Date("2026-01-10"), close: 100, source: "manual" },
        { instrumentId: etf.id, date: new Date("2026-01-10"), close: 100, source: "manual" },
      ],
    });

    const res = await GET(
      new Request("http://localhost/api/overview?asOfDate=2026-01-10&assetKind=STOCK&currency=USD"),
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      data: {
        holdings: Array<{ symbol: string; kind: string }>;
        filters: { assetKinds: string[]; currencies: string[] };
      };
    };

    expect(payload.data.filters.assetKinds).toEqual(["STOCK"]);
    expect(payload.data.filters.currencies).toEqual(["USD"]);
    expect(payload.data.holdings.some((h) => h.symbol === "FILTER_STOCK" && h.kind === "STOCK")).toBe(
      true,
    );
    expect(payload.data.holdings.some((h) => h.symbol === "FILTER_ETF")).toBe(false);
    expect(payload.data.holdings.some((h) => h.kind === "CASH")).toBe(false);
  });
});
