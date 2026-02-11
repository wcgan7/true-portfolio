import { describe, expect, it } from "vitest";

import { getDefaultPortfolioEngines } from "@/src/lib/engines/default-engines";
import type { PortfolioEngines } from "@/src/lib/engines/interfaces";
import { getOverviewSnapshot } from "@/src/lib/services/overview-service";
import type { OverviewHolding } from "@/src/lib/services/valuation-core";

describe("default portfolio engine contracts", () => {
  it("exposes valuation, performance, and exposure engines", () => {
    const engines = getDefaultPortfolioEngines();
    expect(typeof engines.valuationEngine.getSnapshot).toBe("function");
    expect(typeof engines.performanceEngine.getMetrics).toBe("function");
    expect(typeof engines.exposureEngine.applyLookThrough).toBe("function");
    expect(typeof engines.exposureEngine.buildClassificationBreakdown).toBe("function");
  });

  it("valuation engine returns snapshot contract shape", async () => {
    const engines = getDefaultPortfolioEngines();
    const snapshot = await engines.valuationEngine.getSnapshot({
      asOfDate: new Date("2026-01-10"),
    });

    expect(snapshot.asOfDate).toBe("2026-01-10");
    expect(typeof snapshot.totals.totalValue).toBe("number");
    expect(Array.isArray(snapshot.holdings)).toBe(true);
    expect(Array.isArray(snapshot.warnings)).toBe(true);
  });

  it("performance engine returns metrics contract shape", async () => {
    const engines = getDefaultPortfolioEngines();
    const metrics = await engines.performanceEngine.getMetrics({
      asOfDate: new Date("2026-01-10"),
      period: "since_inception",
    });

    expect(metrics.period.type).toBe("since_inception");
    expect(metrics.period.endDate).toBe("2026-01-10");
    expect(metrics).toHaveProperty("mwr");
    expect(metrics).toHaveProperty("twr");
  });

  it("exposure engine handles look-through and classification contracts", async () => {
    const engines = getDefaultPortfolioEngines();
    const holdings: OverviewHolding[] = [
      {
        accountId: "acc-1",
        instrumentId: null,
        symbol: "CASH",
        kind: "CASH",
        quantity: 1,
        marketValue: 100,
        portfolioWeightPct: 100,
        costBasis: 100,
        unrealizedPnl: 0,
        realizedPnl: 0,
      },
    ];

    const lookThrough = await engines.exposureEngine.applyLookThrough({
      holdings,
      asOfDate: "2026-01-10",
    });
    expect(lookThrough.meta.coveragePct).toBe(100);
    expect(Array.isArray(lookThrough.holdings)).toBe(true);

    const classification = await engines.exposureEngine.buildClassificationBreakdown({
      holdings,
      totalValue: 100,
    });
    expect(classification.classifications.byCurrency.some((row) => row.key === "USD")).toBe(true);
    expect(Array.isArray(classification.warnings)).toBe(true);
  });

  it("overview service accepts swapped implementations via interface seam", async () => {
    const stubEngines: PortfolioEngines = {
      valuationEngine: {
        getSnapshot: async () => ({
          asOfDate: "2026-01-10",
          totals: {
            cashValue: 100,
            marketValue: 0,
            totalValue: 100,
            realizedPnl: 0,
            unrealizedPnl: 0,
          },
          holdings: [
            {
              accountId: "acc-stub",
              instrumentId: null,
              symbol: "CASH",
              kind: "CASH",
              quantity: 1,
              marketValue: 100,
              portfolioWeightPct: 100,
              costBasis: 100,
              unrealizedPnl: 0,
              realizedPnl: 0,
            },
          ],
          warnings: [],
        }),
      },
      performanceEngine: {
        getMetrics: async () => ({
          period: {
            type: "since_inception",
            startDate: "2026-01-10",
            endDate: "2026-01-10",
          },
          mwr: 0,
          twr: 0,
        }),
      },
      exposureEngine: {
        applyLookThrough: async ({ holdings }) => ({
          holdings,
          warnings: [],
          meta: {
            coveragePct: 100,
            totalEtfValue: 0,
            coveredEtfValue: 0,
            uncoveredEtfValue: 0,
            staleness: [],
          },
        }),
        buildClassificationBreakdown: async () => ({
          classifications: {
            byCountry: [{ key: "UNCLASSIFIED", marketValue: 100, portfolioWeightPct: 100 }],
            bySector: [{ key: "UNCLASSIFIED", marketValue: 100, portfolioWeightPct: 100 }],
            byIndustry: [{ key: "UNCLASSIFIED", marketValue: 100, portfolioWeightPct: 100 }],
            byCurrency: [{ key: "USD", marketValue: 100, portfolioWeightPct: 100 }],
            summaries: {
              country: {
                classifiedValue: 0,
                unclassifiedValue: 100,
                classifiedPct: 0,
                unclassifiedPct: 100,
              },
              sector: {
                classifiedValue: 0,
                unclassifiedValue: 100,
                classifiedPct: 0,
                unclassifiedPct: 100,
              },
              industry: {
                classifiedValue: 0,
                unclassifiedValue: 100,
                classifiedPct: 0,
                unclassifiedPct: 100,
              },
              currency: {
                classifiedValue: 100,
                unclassifiedValue: 0,
                classifiedPct: 100,
                unclassifiedPct: 0,
              },
            },
          },
          warnings: [],
        }),
      },
    };

    const snapshot = await getOverviewSnapshot({
      mode: "lookthrough",
      engines: stubEngines,
    });

    expect(snapshot.asOfDate).toBe("2026-01-10");
    expect(snapshot.totals.totalValue).toBe(100);
    expect(snapshot.totals.mwr).toBe(0);
    expect(snapshot.totals.twr).toBe(0);
    expect(snapshot.mode).toBe("lookthrough");
    expect(snapshot.holdings).toHaveLength(1);
    expect(snapshot.classifications.byCurrency[0]?.key).toBe("USD");
    expect(snapshot.lookThrough?.coveragePct).toBe(100);
  });
});
