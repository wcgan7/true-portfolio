import type { PortfolioEngines } from "@/src/lib/engines/interfaces";
import { getDefaultPortfolioEngines } from "@/src/lib/engines/default-engines";
import { prisma } from "@/src/lib/db";
import { persistWarningLifecycle } from "@/src/lib/services/warning-service";
import type {
  PerformanceMetrics,
  PerformancePeriod,
} from "@/src/lib/services/performance-service";
import type {
  ClassificationBreakdown,
  LookThroughMeta,
} from "@/src/lib/services/overview-types";
import type {
  OverviewHolding,
  OverviewWarning,
} from "@/src/lib/services/valuation-core";

export type { LookThroughMeta, ExposureBucket, ClassificationSummary, ClassificationBreakdown } from "@/src/lib/services/overview-types";

export type OverviewMode = "raw" | "lookthrough";

export type OverviewSnapshot = {
  asOfDate: string;
  mode: OverviewMode;
  totals: {
    cashValue: number;
    marketValue: number;
    totalValue: number;
    realizedPnl: number;
    unrealizedPnl: number;
    mwr: number | null;
    twr: number | null;
  };
  performance: PerformanceMetrics;
  holdings: OverviewHolding[];
  warnings: OverviewWarning[];
  lookThrough: LookThroughMeta | null;
  classifications: ClassificationBreakdown;
  filters: {
    assetKinds: Array<OverviewHolding["kind"]>;
    currencies: string[];
  };
  freshness: {
    scopedValuationExists: boolean;
    scopedValuationComplete: boolean | null;
    scopedValuationMaterializedAt: string | null;
    lastValuationMaterializedAt: string | null;
    lastValuationDate: string | null;
    lastPriceFetchedAt: string | null;
  };
};

function recomputeWeights(holdings: OverviewHolding[], totalValue: number): OverviewHolding[] {
  const denominator = Math.abs(totalValue) <= 1e-9 ? 1 : totalValue;
  const cloned = holdings.map((holding) => ({
    ...holding,
    portfolioWeightPct: (holding.marketValue / denominator) * 100,
  }));
  cloned.sort((a, b) => b.marketValue - a.marketValue);
  return cloned;
}

export async function getOverviewSnapshot(params?: {
  accountId?: string;
  asOfDate?: Date;
  period?: PerformancePeriod;
  from?: Date;
  to?: Date;
  mode?: OverviewMode;
  assetKinds?: Array<OverviewHolding["kind"]>;
  currencies?: string[];
  engines?: PortfolioEngines;
}): Promise<OverviewSnapshot> {
  const engines = params?.engines ?? getDefaultPortfolioEngines();
  const [valuation, performance] = await Promise.all([
    engines.valuationEngine.getSnapshot({
      accountId: params?.accountId,
      asOfDate: params?.asOfDate,
    }),
    engines.performanceEngine.getMetrics({
      accountId: params?.accountId,
      asOfDate: params?.asOfDate,
      period: params?.period,
      from: params?.from,
      to: params?.to,
    }),
  ]);

  const mode = params?.mode ?? "raw";
  const normalizedAssetKinds = [...new Set(params?.assetKinds ?? [])];
  const normalizedCurrencies = [...new Set((params?.currencies ?? []).map((c) => c.toUpperCase()))];
  let holdings = valuation.holdings;
  let warnings = [...valuation.warnings];
  let lookThrough: LookThroughMeta | null = null;

  if (mode === "lookthrough") {
    const flattened = await engines.exposureEngine.applyLookThrough({
      holdings: valuation.holdings,
      asOfDate: valuation.asOfDate,
    });
    holdings = flattened.holdings;
    warnings = warnings.concat(flattened.warnings);
    lookThrough = flattened.meta;
  }

  holdings = recomputeWeights(holdings, valuation.totals.totalValue);
  if (normalizedAssetKinds.length) {
    holdings = holdings.filter((holding) => normalizedAssetKinds.includes(holding.kind));
  }
  if (normalizedCurrencies.length) {
    const instrumentIds = [
      ...new Set(holdings.map((holding) => holding.instrumentId).filter(Boolean)),
    ] as string[];
    const instrumentCurrencyById = new Map<string, string>();
    if (instrumentIds.length) {
      const instruments = await prisma.instrument.findMany({
        where: { id: { in: instrumentIds } },
        select: { id: true, currency: true },
      });
      for (const instrument of instruments) {
        instrumentCurrencyById.set(instrument.id, instrument.currency.toUpperCase());
      }
    }
    holdings = holdings.filter((holding) => {
      const currency =
        holding.kind === "CASH"
          ? "USD"
          : holding.instrumentId
            ? instrumentCurrencyById.get(holding.instrumentId) ?? "UNCLASSIFIED"
            : "UNCLASSIFIED";
      return normalizedCurrencies.includes(currency);
    });
  }

  const classification = await engines.exposureEngine.buildClassificationBreakdown({
    holdings,
    totalValue: valuation.totals.totalValue,
  });
  warnings = warnings.concat(classification.warnings);
  const scopedValuation = await prisma.dailyValuation.findFirst({
    where: {
      date: new Date(`${valuation.asOfDate}T00:00:00.000Z`),
      accountId: params?.accountId ?? null,
    },
    select: {
      completenessFlag: true,
      createdAt: true,
    },
  });
  const [latestValuation, latestPrice] = await Promise.all([
    prisma.dailyValuation.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, date: true },
    }),
    prisma.pricePoint.findFirst({
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    }),
  ]);
  const hasViewFilters = normalizedAssetKinds.length > 0 || normalizedCurrencies.length > 0;
  if (!hasViewFilters) {
    await persistWarningLifecycle({
      asOfDate: valuation.asOfDate,
      warnings,
      accountId: params?.accountId,
      mode,
    });
  }

  return {
    asOfDate: valuation.asOfDate,
    mode,
    totals: {
      cashValue: valuation.totals.cashValue,
      marketValue: valuation.totals.marketValue,
      totalValue: valuation.totals.totalValue,
      realizedPnl: valuation.totals.realizedPnl,
      unrealizedPnl: valuation.totals.unrealizedPnl,
      mwr: performance.mwr,
      twr: performance.twr,
    },
    performance,
    holdings,
    warnings,
    lookThrough,
    classifications: classification.classifications,
    filters: {
      assetKinds: normalizedAssetKinds,
      currencies: normalizedCurrencies,
    },
    freshness: {
      scopedValuationExists: Boolean(scopedValuation),
      scopedValuationComplete: scopedValuation?.completenessFlag ?? null,
      scopedValuationMaterializedAt: scopedValuation?.createdAt.toISOString() ?? null,
      lastValuationMaterializedAt: latestValuation?.createdAt.toISOString() ?? null,
      lastValuationDate: latestValuation?.date.toISOString().slice(0, 10) ?? null,
      lastPriceFetchedAt: latestPrice?.fetchedAt.toISOString() ?? null,
    },
  };
}
