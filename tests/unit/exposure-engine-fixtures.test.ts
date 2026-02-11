import { describe, expect, it } from "vitest";

import { prisma } from "@/src/lib/db";
import { tsExposureEngine } from "@/src/lib/engines/ts/exposure-engine";

describe("exposure-engine fixture coverage", () => {
  it("flattens ETF exposure, aggregates overlap, and keeps uncovered bucket", async () => {
    const etf = await prisma.instrument.create({
      data: { symbol: "ETF_FIX_A", name: "ETF Fixture A", kind: "ETF", currency: "USD" },
    });

    await prisma.etfConstituent.createMany({
      data: [
        {
          etfInstrumentId: etf.id,
          constituentSymbol: "AAPL_FIX",
          weight: 0.5,
          asOfDate: new Date("2026-01-10"),
          source: "manual",
        },
        {
          etfInstrumentId: etf.id,
          constituentSymbol: "MSFT_FIX",
          weight: 0.4,
          asOfDate: new Date("2026-01-10"),
          source: "manual",
        },
      ],
    });

    const flattened = await tsExposureEngine.applyLookThrough({
      asOfDate: "2026-01-10",
      holdings: [
        {
          accountId: "acc-1",
          instrumentId: etf.id,
          symbol: "ETF_FIX_A",
          kind: "ETF",
          quantity: 1,
          marketValue: 100,
          portfolioWeightPct: 100,
          costBasis: 100,
          unrealizedPnl: 0,
          realizedPnl: 0,
        },
        {
          accountId: "acc-1",
          instrumentId: null,
          symbol: "AAPL_FIX",
          kind: "STOCK",
          quantity: 1,
          marketValue: 50,
          portfolioWeightPct: 50,
          costBasis: 50,
          unrealizedPnl: 0,
          realizedPnl: 0,
        },
      ],
    });

    const aapl = flattened.holdings.find((holding) => holding.symbol === "AAPL_FIX");
    const msft = flattened.holdings.find((holding) => holding.symbol === "MSFT_FIX");
    const unmapped = flattened.holdings.find((holding) => holding.symbol === "UNMAPPED_ETF_EXPOSURE");

    expect(aapl).toBeDefined();
    expect(msft).toBeDefined();
    expect(unmapped).toBeDefined();
    expect(aapl!.marketValue).toBeCloseTo(100, 6);
    expect(msft!.marketValue).toBeCloseTo(40, 6);
    expect(unmapped!.marketValue).toBeCloseTo(10, 6);
    expect(flattened.meta.coveragePct).toBeCloseTo(90, 6);
    expect(flattened.meta.uncoveredEtfValue).toBeCloseTo(10, 6);
  });

  it("creates uncovered bucket and warning when ETF constituents are unavailable", async () => {
    const etf = await prisma.instrument.create({
      data: { symbol: "ETF_FIX_B", name: "ETF Fixture B", kind: "ETF", currency: "USD" },
    });

    const flattened = await tsExposureEngine.applyLookThrough({
      asOfDate: "2026-01-10",
      holdings: [
        {
          accountId: "acc-1",
          instrumentId: etf.id,
          symbol: "ETF_FIX_B",
          kind: "ETF",
          quantity: 1,
          marketValue: 100,
          portfolioWeightPct: 100,
          costBasis: 100,
          unrealizedPnl: 0,
          realizedPnl: 0,
        },
      ],
    });

    const unmapped = flattened.holdings.find((holding) => holding.symbol === "UNMAPPED_ETF_EXPOSURE");
    expect(unmapped).toBeDefined();
    expect(unmapped!.marketValue).toBeCloseTo(100, 6);
    expect(flattened.meta.coveragePct).toBeCloseTo(0, 6);
    expect(
      flattened.warnings.some((warning) => warning.code === "ETF_LOOKTHROUGH_UNAVAILABLE"),
    ).toBe(true);
  });
});
