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
import { persistWarningLifecycle } from "@/src/lib/services/warning-service";

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

type ClassificationDimension = "country" | "sector" | "industry" | "currency";

export type ExposureBucket = {
  key: string;
  marketValue: number;
  portfolioWeightPct: number;
};

export type ClassificationSummary = {
  classifiedValue: number;
  unclassifiedValue: number;
  classifiedPct: number;
  unclassifiedPct: number;
};

export type ClassificationBreakdown = {
  byCountry: ExposureBucket[];
  bySector: ExposureBucket[];
  byIndustry: ExposureBucket[];
  byCurrency: ExposureBucket[];
  summaries: {
    country: ClassificationSummary;
    sector: ClassificationSummary;
    industry: ClassificationSummary;
    currency: ClassificationSummary;
  };
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
  classifications: ClassificationBreakdown;
  filters: {
    assetKinds: Array<OverviewHolding["kind"]>;
    currencies: string[];
  };
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

function readMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const value = (metadata as Record<string, unknown>)[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeBucketKey(value: string | null | undefined): string {
  return value ? value : "UNCLASSIFIED";
}

function summarizeCoverage(params: {
  buckets: Map<string, number>;
  denominatorAbs: number;
}): ClassificationSummary {
  const unclassifiedValue = Math.abs(params.buckets.get("UNCLASSIFIED") ?? 0);
  const classifiedValue = Math.max(0, params.denominatorAbs - unclassifiedValue);
  if (params.denominatorAbs <= 1e-9) {
    return {
      classifiedValue: 0,
      unclassifiedValue: 0,
      classifiedPct: 100,
      unclassifiedPct: 0,
    };
  }
  return {
    classifiedValue: round6(classifiedValue),
    unclassifiedValue: round6(unclassifiedValue),
    classifiedPct: round6((classifiedValue / params.denominatorAbs) * 100),
    unclassifiedPct: round6((unclassifiedValue / params.denominatorAbs) * 100),
  };
}

async function buildClassificationBreakdown(params: {
  holdings: OverviewHolding[];
  totalValue: number;
}): Promise<{ classifications: ClassificationBreakdown; warnings: OverviewWarning[] }> {
  const warnings: OverviewWarning[] = [];
  const byId = new Map<
    string,
    {
      currency: string | null;
      country: string | null;
      sector: string | null;
      industry: string | null;
    }
  >();
  const bySymbol = new Map<
    string,
    {
      currency: string | null;
      country: string | null;
      sector: string | null;
      industry: string | null;
    }
  >();

  const instrumentIds = [...new Set(params.holdings.map((h) => h.instrumentId).filter(Boolean))] as string[];
  const symbolNeedsLookup = [
    ...new Set(
      params.holdings
        .filter((holding) => !holding.instrumentId && holding.symbol !== "CASH")
        .map((holding) => holding.symbol.toUpperCase()),
    ),
  ];

  const [idRows, symbolRows] = await Promise.all([
    instrumentIds.length
      ? prisma.instrument.findMany({
          where: { id: { in: instrumentIds } },
          select: { id: true, symbol: true, currency: true, metadataJson: true },
        })
      : Promise.resolve([]),
    symbolNeedsLookup.length
      ? prisma.instrument.findMany({
          where: { symbol: { in: symbolNeedsLookup } },
          select: { symbol: true, currency: true, metadataJson: true },
          orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  for (const row of idRows) {
    byId.set(row.id, {
      currency: row.currency ?? null,
      country: readMetadataString(row.metadataJson, "country"),
      sector: readMetadataString(row.metadataJson, "sector"),
      industry: readMetadataString(row.metadataJson, "industry"),
    });
  }
  for (const row of symbolRows) {
    const symbolKey = row.symbol.toUpperCase();
    if (bySymbol.has(symbolKey)) {
      continue;
    }
    bySymbol.set(symbolKey, {
      currency: row.currency ?? null,
      country: readMetadataString(row.metadataJson, "country"),
      sector: readMetadataString(row.metadataJson, "sector"),
      industry: readMetadataString(row.metadataJson, "industry"),
    });
  }

  const country = new Map<string, number>();
  const sector = new Map<string, number>();
  const industry = new Map<string, number>();
  const currency = new Map<string, number>();
  const unknownSymbols = new Set<string>();
  const denominator = Math.abs(params.totalValue) <= 1e-9 ? 1 : params.totalValue;
  const denominatorAbs = params.holdings.reduce((sum, h) => sum + Math.abs(h.marketValue), 0);

  const accumulate = (map: Map<string, number>, key: string, value: number) => {
    map.set(key, (map.get(key) ?? 0) + value);
  };

  for (const holding of params.holdings) {
    const metadata =
      (holding.instrumentId ? byId.get(holding.instrumentId) : null) ??
      bySymbol.get(holding.symbol.toUpperCase()) ??
      null;

    if (!holding.instrumentId && holding.symbol !== "CASH" && !metadata) {
      unknownSymbols.add(holding.symbol.toUpperCase());
    }

    const currencyKey = normalizeBucketKey(
      metadata?.currency ?? (holding.kind === "CASH" ? "USD" : null),
    );
    const countryKey = normalizeBucketKey(metadata?.country);
    const sectorKey = normalizeBucketKey(metadata?.sector);
    const industryKey = normalizeBucketKey(metadata?.industry);

    accumulate(currency, currencyKey, holding.marketValue);
    accumulate(country, countryKey, holding.marketValue);
    accumulate(sector, sectorKey, holding.marketValue);
    accumulate(industry, industryKey, holding.marketValue);
  }

  const toBuckets = (map: Map<string, number>): ExposureBucket[] =>
    [...map.entries()]
      .map(([key, marketValue]) => ({
        key,
        marketValue: round6(marketValue),
        portfolioWeightPct: round6((marketValue / denominator) * 100),
      }))
      .sort((a, b) => b.marketValue - a.marketValue);

  const summaries = {
    country: summarizeCoverage({ buckets: country, denominatorAbs }),
    sector: summarizeCoverage({ buckets: sector, denominatorAbs }),
    industry: summarizeCoverage({ buckets: industry, denominatorAbs }),
    currency: summarizeCoverage({ buckets: currency, denominatorAbs }),
  };

  const emitUnclassifiedWarning = (
    dimension: ClassificationDimension,
    summary: ClassificationSummary,
  ) => {
    if (summary.unclassifiedValue <= 1e-9) {
      return;
    }
    warnings.push({
      code: "UNCLASSIFIED_EXPOSURE",
      message: `Unclassified ${dimension} exposure: ${summary.unclassifiedPct.toFixed(2)}%`,
      instrumentId: null,
      symbol: `UNCLASSIFIED_${dimension.toUpperCase()}`,
    });
  };

  emitUnclassifiedWarning("country", summaries.country);
  emitUnclassifiedWarning("sector", summaries.sector);
  emitUnclassifiedWarning("industry", summaries.industry);
  emitUnclassifiedWarning("currency", summaries.currency);
  for (const symbol of unknownSymbols) {
    warnings.push({
      code: "UNKNOWN_TICKER",
      message: `Unknown ticker in exposure mapping: ${symbol}`,
      instrumentId: null,
      symbol,
    });
  }

  return {
    classifications: {
      byCountry: toBuckets(country),
      bySector: toBuckets(sector),
      byIndustry: toBuckets(industry),
      byCurrency: toBuckets(currency),
      summaries,
    },
    warnings,
  };
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
        accountId: etf.accountId,
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
        accountId: etf.accountId,
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
        accountId: etf.accountId,
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
        accountId: etf.accountId,
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
  assetKinds?: Array<OverviewHolding["kind"]>;
  currencies?: string[];
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
  const normalizedAssetKinds = [...new Set(params?.assetKinds ?? [])];
  const normalizedCurrencies = [...new Set((params?.currencies ?? []).map((c) => c.toUpperCase()))];
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

  const classification = await buildClassificationBreakdown({
    holdings,
    totalValue: valuation.totals.totalValue,
  });
  warnings = warnings.concat(classification.warnings);
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
  };
}
