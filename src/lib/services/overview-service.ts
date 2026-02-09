import {
  type PerformanceMetrics,
  type PerformancePeriod,
  getPerformanceMetrics,
} from "@/src/lib/services/performance-service";
import { prisma } from "@/src/lib/db";
import {
  type OverviewHolding,
  type OverviewWarning,
  getValuationSnapshotCore,
} from "@/src/lib/services/valuation-core";

export type OverviewMode = "raw" | "lookthrough";

export type LookThroughMeta = {
  coveragePct: number;
  totalEtfValue: number;
  coveredEtfValue: number;
  uncoveredEtfValue: number;
  staleness: Array<{
    etfSymbol: string;
    asOfDate: string | null;
  }>;
};

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
};

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function recomputeWeights(holdings: OverviewHolding[], totalValue: number): OverviewHolding[] {
  const denominator = Math.abs(totalValue) <= 1e-9 ? 1 : totalValue;
  const cloned = holdings.map((holding) => ({
    ...holding,
    portfolioWeightPct: (holding.marketValue / denominator) * 100,
  }));
  cloned.sort((a, b) => b.marketValue - a.marketValue);
  return cloned;
}

async function applyLookThrough(params: {
  holdings: OverviewHolding[];
  asOfDate: string;
}): Promise<{
  holdings: OverviewHolding[];
  warnings: OverviewWarning[];
  meta: LookThroughMeta;
}> {
  const asOfDate = new Date(`${params.asOfDate}T00:00:00.000Z`);
  const warnings: OverviewWarning[] = [];
  const merged = new Map<
    string,
    {
      accountId: string;
      instrumentId: string | null;
      symbol: string;
      kind: OverviewHolding["kind"];
      marketValue: number;
      costBasis: number;
      unrealizedPnl: number;
      realizedPnl: number;
    }
  >();

  let totalEtfValue = 0;
  let coveredEtfValue = 0;
  let uncoveredEtfValue = 0;
  const staleness: LookThroughMeta["staleness"] = [];

  const addMerged = (row: {
    accountId: string;
    instrumentId: string | null;
    symbol: string;
    kind: OverviewHolding["kind"];
    marketValue: number;
    costBasis?: number;
    unrealizedPnl?: number;
    realizedPnl?: number;
  }) => {
    const key = `${row.accountId}:${row.symbol}:${row.kind}`;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, {
        accountId: row.accountId,
        instrumentId: row.instrumentId,
        symbol: row.symbol,
        kind: row.kind,
        marketValue: row.marketValue,
        costBasis: row.costBasis ?? 0,
        unrealizedPnl: row.unrealizedPnl ?? 0,
        realizedPnl: row.realizedPnl ?? 0,
      });
      return;
    }
    existing.marketValue += row.marketValue;
    existing.costBasis += row.costBasis ?? 0;
    existing.unrealizedPnl += row.unrealizedPnl ?? 0;
    existing.realizedPnl += row.realizedPnl ?? 0;
  };

  const etfHoldings = params.holdings.filter((holding) => holding.kind === "ETF" && holding.instrumentId);
  const nonEtfHoldings = params.holdings.filter((holding) => holding.kind !== "ETF");

  for (const holding of nonEtfHoldings) {
    addMerged({
      accountId: holding.accountId,
      instrumentId: holding.instrumentId,
      symbol: holding.symbol,
      kind: holding.kind,
      marketValue: holding.marketValue,
      costBasis: holding.costBasis,
      unrealizedPnl: holding.unrealizedPnl,
      realizedPnl: holding.realizedPnl,
    });
  }

  for (const etf of etfHoldings) {
    totalEtfValue += etf.marketValue;

    const latestAsOf = await prisma.etfConstituent.findFirst({
      where: {
        etfInstrumentId: etf.instrumentId!,
        asOfDate: { lte: asOfDate },
      },
      orderBy: { asOfDate: "desc" },
      select: { asOfDate: true },
    });

    if (!latestAsOf) {
      warnings.push({
        code: "ETF_LOOKTHROUGH_UNAVAILABLE",
        message: `No ETF constituent data for ${etf.symbol} on or before ${params.asOfDate}`,
        instrumentId: etf.instrumentId!,
        symbol: etf.symbol,
      });
      uncoveredEtfValue += etf.marketValue;
      continue;
    }

    const asOfDateKey = latestAsOf.asOfDate.toISOString().slice(0, 10);
    staleness.push({ etfSymbol: etf.symbol, asOfDate: asOfDateKey });
    if (asOfDateKey !== params.asOfDate) {
      warnings.push({
        code: "ETF_LOOKTHROUGH_STALE",
        message: `Using stale ETF constituents for ${etf.symbol} from ${asOfDateKey}`,
        instrumentId: etf.instrumentId!,
        symbol: etf.symbol,
      });
    }

    const constituents = await prisma.etfConstituent.findMany({
      where: {
        etfInstrumentId: etf.instrumentId!,
        asOfDate: latestAsOf.asOfDate,
      },
      select: {
        constituentSymbol: true,
        weight: true,
      },
    });

    if (constituents.length === 0) {
      warnings.push({
        code: "ETF_LOOKTHROUGH_UNAVAILABLE",
        message: `ETF constituent dataset is empty for ${etf.symbol}`,
        instrumentId: etf.instrumentId!,
        symbol: etf.symbol,
      });
      uncoveredEtfValue += etf.marketValue;
      continue;
    }

    const rawWeights = constituents.map((c) => Number(c.weight));
    const sumWeights = rawWeights.reduce((sum, w) => sum + w, 0);
    if (sumWeights <= 0) {
      warnings.push({
        code: "ETF_LOOKTHROUGH_UNAVAILABLE",
        message: `ETF constituent weights invalid for ${etf.symbol}`,
        instrumentId: etf.instrumentId!,
        symbol: etf.symbol,
      });
      uncoveredEtfValue += etf.marketValue;
      continue;
    }

    const normalizer = sumWeights > 1 ? sumWeights : 1;
    let allocated = 0;
    for (const constituent of constituents) {
      const weight = Number(constituent.weight) / normalizer;
      if (weight <= 0) continue;
      const value = etf.marketValue * weight;
      allocated += value;
      addMerged({
        accountId: etf.accountId,
        instrumentId: null,
        symbol: constituent.constituentSymbol.toUpperCase(),
        kind: "STOCK",
        marketValue: value,
      });
    }

    coveredEtfValue += allocated;
    const uncovered = Math.max(0, etf.marketValue - allocated);
    uncoveredEtfValue += uncovered;
  }

  if (uncoveredEtfValue > 1e-9) {
    addMerged({
      accountId: "portfolio",
      instrumentId: null,
      symbol: "UNMAPPED_ETF_EXPOSURE",
      kind: "CUSTOM",
      marketValue: uncoveredEtfValue,
    });
  }

  const flattened: OverviewHolding[] = [...merged.values()].map((row) => ({
    accountId: row.accountId,
    instrumentId: row.instrumentId,
    symbol: row.symbol,
    kind: row.kind,
    quantity: row.kind === "CASH" ? 1 : 0,
    marketValue: round6(row.marketValue),
    portfolioWeightPct: 0,
    costBasis: round6(row.costBasis),
    unrealizedPnl: round6(row.unrealizedPnl),
    realizedPnl: round6(row.realizedPnl),
  }));

  const coveragePct = totalEtfValue <= 1e-9 ? 100 : (coveredEtfValue / totalEtfValue) * 100;
  return {
    holdings: flattened,
    warnings,
    meta: {
      coveragePct: round6(coveragePct),
      totalEtfValue: round6(totalEtfValue),
      coveredEtfValue: round6(coveredEtfValue),
      uncoveredEtfValue: round6(uncoveredEtfValue),
      staleness,
    },
  };
}

export async function getOverviewSnapshot(params?: {
  accountId?: string;
  asOfDate?: Date;
  period?: PerformancePeriod;
  from?: Date;
  to?: Date;
  mode?: OverviewMode;
}): Promise<OverviewSnapshot> {
  const [valuation, performance] = await Promise.all([
    getValuationSnapshotCore({
      accountId: params?.accountId,
      asOfDate: params?.asOfDate,
    }),
    getPerformanceMetrics({
      accountId: params?.accountId,
      asOfDate: params?.asOfDate,
      period: params?.period,
      from: params?.from,
      to: params?.to,
    }),
  ]);

  const mode = params?.mode ?? "raw";
  let holdings = valuation.holdings;
  let warnings = [...valuation.warnings];
  let lookThrough: LookThroughMeta | null = null;

  if (mode === "lookthrough") {
    const flattened = await applyLookThrough({
      holdings: valuation.holdings,
      asOfDate: valuation.asOfDate,
    });
    holdings = flattened.holdings;
    warnings = warnings.concat(flattened.warnings);
    lookThrough = flattened.meta;
  }

  holdings = recomputeWeights(holdings, valuation.totals.totalValue);

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
  };
}
