import { prisma } from "@/src/lib/db";
import type { PortfolioEngines } from "@/src/lib/engines/interfaces";
import { DomainValidationError } from "@/src/lib/errors";
import { cashDeltaForTransaction } from "@/src/lib/portfolio/ledger";
import { getOverviewSnapshot, type OverviewMode } from "@/src/lib/services/overview-service";
import { toUtcDateOnly } from "@/src/lib/time/date";
import type { OverviewHolding } from "@/src/lib/services/valuation-core";

export type AuditMetric =
  | "totalValue"
  | "marketValue"
  | "cashValue"
  | "realizedPnl"
  | "unrealizedPnl"
  | "mwr"
  | "twr";

export type AuditScopeDimension = "holding" | "country" | "sector" | "industry" | "currency";

export type MetricAuditPayload = {
  metric: AuditMetric;
  asOfDate: string;
  accountId: string | null;
  mode: OverviewMode;
  scope: { dimension: AuditScopeDimension; symbol: string } | null;
  value: number | null;
  contributors: {
    holdings: Array<{
      accountId: string;
      instrumentId: string | null;
      symbol: string;
      kind: string;
      marketValue: number;
      portfolioWeightPct: number;
    }>;
    transactions: Array<{
      id: string;
      accountId: string;
      instrumentId: string | null;
      type: string;
      tradeDate: string;
      amount: number;
      feeAmount: number;
      signedCashDelta: number;
    }>;
    warnings: Array<{
      code: string;
      severity: string;
      accountId: string | null;
      instrumentId: string | null;
      date: string;
      resolvedAt: string | null;
      message: string | null;
      symbol: string | null;
    }>;
  };
};

const ALLOWED_METRICS: AuditMetric[] = [
  "totalValue",
  "marketValue",
  "cashValue",
  "realizedPnl",
  "unrealizedPnl",
  "mwr",
  "twr",
];

const ALLOWED_SCOPE_DIMENSIONS: AuditScopeDimension[] = [
  "holding",
  "country",
  "sector",
  "industry",
  "currency",
];

function toNumber(value: unknown): number {
  return Number(value);
}

function normalizeScopeValue(value: string): string {
  return value.trim().toUpperCase();
}

function readMetadataString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const raw = (metadata as Record<string, unknown>)[key];
  if (typeof raw !== "string") {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeBucketKey(value: string | null | undefined): string {
  return value ? value : "UNCLASSIFIED";
}

async function loadHoldingMetadata(holdings: OverviewHolding[]) {
  const ids = [...new Set(holdings.map((holding) => holding.instrumentId).filter(Boolean))] as string[];
  const symbols = [
    ...new Set(
      holdings
        .filter((holding) => !holding.instrumentId && holding.symbol !== "CASH")
        .map((holding) => holding.symbol.toUpperCase()),
    ),
  ];

  const [idRows, symbolRows] = await Promise.all([
    ids.length
      ? prisma.instrument.findMany({
          where: { id: { in: ids } },
          select: { id: true, symbol: true, currency: true, metadataJson: true },
        })
      : Promise.resolve([]),
    symbols.length
      ? prisma.instrument.findMany({
          where: { symbol: { in: symbols } },
          select: { id: true, symbol: true, currency: true, metadataJson: true },
          orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const byId = new Map<
    string,
    { id: string; symbol: string; currency: string | null; country: string | null; sector: string | null; industry: string | null }
  >();
  const bySymbol = new Map<
    string,
    { id: string; symbol: string; currency: string | null; country: string | null; sector: string | null; industry: string | null }
  >();

  for (const row of idRows) {
    byId.set(row.id, {
      id: row.id,
      symbol: row.symbol.toUpperCase(),
      currency: row.currency ?? null,
      country: readMetadataString(row.metadataJson, "country"),
      sector: readMetadataString(row.metadataJson, "sector"),
      industry: readMetadataString(row.metadataJson, "industry"),
    });
  }
  for (const row of symbolRows) {
    const symbol = row.symbol.toUpperCase();
    if (bySymbol.has(symbol)) {
      continue;
    }
    bySymbol.set(symbol, {
      id: row.id,
      symbol,
      currency: row.currency ?? null,
      country: readMetadataString(row.metadataJson, "country"),
      sector: readMetadataString(row.metadataJson, "sector"),
      industry: readMetadataString(row.metadataJson, "industry"),
    });
  }

  return { byId, bySymbol };
}

function holdingBucketValue(
  holding: OverviewHolding,
  dimension: AuditScopeDimension,
  metadata: {
    byId: Map<string, { id: string; symbol: string; currency: string | null; country: string | null; sector: string | null; industry: string | null }>;
    bySymbol: Map<string, { id: string; symbol: string; currency: string | null; country: string | null; sector: string | null; industry: string | null }>;
  },
): string {
  if (dimension === "holding") {
    return holding.symbol;
  }

  const row =
    (holding.instrumentId ? metadata.byId.get(holding.instrumentId) : null) ??
    metadata.bySymbol.get(holding.symbol.toUpperCase()) ??
    null;
  if (dimension === "currency") {
    return normalizeBucketKey(row?.currency ?? (holding.kind === "CASH" ? "USD" : null));
  }
  if (dimension === "country") {
    return normalizeBucketKey(row?.country);
  }
  if (dimension === "sector") {
    return normalizeBucketKey(row?.sector);
  }
  return normalizeBucketKey(row?.industry);
}

function metricValue(snapshot: Awaited<ReturnType<typeof getOverviewSnapshot>>, metric: AuditMetric): number | null {
  switch (metric) {
    case "totalValue":
      return snapshot.totals.totalValue;
    case "marketValue":
      return snapshot.totals.marketValue;
    case "cashValue":
      return snapshot.totals.cashValue;
    case "realizedPnl":
      return snapshot.totals.realizedPnl;
    case "unrealizedPnl":
      return snapshot.totals.unrealizedPnl;
    case "mwr":
      return snapshot.totals.mwr;
    case "twr":
      return snapshot.totals.twr;
    default: {
      const _exhaustive: never = metric;
      return _exhaustive;
    }
  }
}

export async function getMetricAudit(params: {
  metric: string;
  accountId?: string;
  asOfDate?: Date;
  mode?: OverviewMode;
  scopeDimension?: string;
  scopeSymbol?: string;
  engines?: PortfolioEngines;
}): Promise<MetricAuditPayload> {
  if (!ALLOWED_METRICS.includes(params.metric as AuditMetric)) {
    throw new DomainValidationError(
      "Invalid metric. Use totalValue, marketValue, cashValue, realizedPnl, unrealizedPnl, mwr, or twr.",
    );
  }

  const metric = params.metric as AuditMetric;
  const asOfDate = toUtcDateOnly(params.asOfDate ?? new Date());
  const mode = params.mode ?? "raw";
  let scope: { dimension: AuditScopeDimension; symbol: string } | null = null;
  if (params.scopeDimension || params.scopeSymbol) {
    if (!params.scopeDimension || !params.scopeSymbol) {
      throw new DomainValidationError("scopeDimension and scopeSymbol must be provided together.");
    }
    if (!ALLOWED_SCOPE_DIMENSIONS.includes(params.scopeDimension as AuditScopeDimension)) {
      throw new DomainValidationError(
        "Invalid scopeDimension. Use holding, country, sector, industry, or currency.",
      );
    }
    scope = {
      dimension: params.scopeDimension as AuditScopeDimension,
      symbol: params.scopeSymbol,
    };
  }

  const snapshot = await getOverviewSnapshot({
    accountId: params.accountId,
    asOfDate,
    mode,
    engines: params.engines,
  });

  let scopedHoldings = snapshot.holdings;
  let scopedInstrumentIds = new Set<string>();
  let scopedSymbols = new Set<string>();
  if (scope) {
    const metadata = await loadHoldingMetadata(snapshot.holdings);
    const normalizedScopeSymbol = normalizeScopeValue(scope.symbol);
    scopedHoldings = snapshot.holdings.filter((holding) => {
      const bucket = holdingBucketValue(holding, scope!.dimension, metadata);
      return normalizeScopeValue(bucket) === normalizedScopeSymbol;
    });
    scopedInstrumentIds = new Set(scopedHoldings.map((holding) => holding.instrumentId).filter(Boolean) as string[]);
    const noIdSymbols = [...new Set(scopedHoldings.filter((holding) => !holding.instrumentId).map((holding) => holding.symbol.toUpperCase()))];
    if (noIdSymbols.length > 0) {
      const symbolRows = await prisma.instrument.findMany({
        where: { symbol: { in: noIdSymbols } },
        select: { id: true },
      });
      for (const row of symbolRows) {
        scopedInstrumentIds.add(row.id);
      }
    }
    scopedSymbols = new Set(scopedHoldings.map((holding) => holding.symbol.toUpperCase()));
  }

  const txRows = await prisma.transaction.findMany({
    where: {
      ...(params.accountId ? { accountId: params.accountId } : {}),
      tradeDate: { lte: asOfDate },
    },
    orderBy: [{ tradeDate: "asc" }, { createdAt: "asc" }],
  });

  const warningRows = await prisma.warningEvent.findMany({
    where: {
      ...(params.accountId ? { accountId: params.accountId } : {}),
      metadataJson: {
        path: ["mode"],
        equals: mode,
      },
      date: { lte: asOfDate },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 100,
  });

  return {
    metric,
    asOfDate: asOfDate.toISOString().slice(0, 10),
    accountId: params.accountId ?? null,
    mode,
    scope,
    value: metricValue(snapshot, metric),
    contributors: {
      holdings: scopedHoldings.map((holding) => ({
        accountId: holding.accountId,
        instrumentId: holding.instrumentId,
        symbol: holding.symbol,
        kind: holding.kind,
        marketValue: holding.marketValue,
        portfolioWeightPct: holding.portfolioWeightPct,
      })),
      transactions: txRows
        .filter((row) => {
          if (!scope) {
            return true;
          }
          if (scope.dimension === "holding" && normalizeScopeValue(scope.symbol) === "CASH") {
            return true;
          }
          if (row.instrumentId && scopedInstrumentIds.has(row.instrumentId)) {
            return true;
          }
          if (!row.instrumentId && scopedSymbols.has("CASH")) {
            return true;
          }
          return false;
        })
        .map((row) => ({
        id: row.id,
        accountId: row.accountId,
        instrumentId: row.instrumentId,
        type: row.type,
        tradeDate: row.tradeDate.toISOString().slice(0, 10),
        amount: toNumber(row.amount),
        feeAmount: toNumber(row.feeAmount),
        signedCashDelta: cashDeltaForTransaction({
          type: row.type,
          quantity: row.quantity == null ? undefined : toNumber(row.quantity),
          price: row.price == null ? undefined : toNumber(row.price),
          amount: toNumber(row.amount),
          feeAmount: toNumber(row.feeAmount),
        }),
      })),
      warnings: warningRows
        .filter((warning) => {
          if (!scope) {
            return true;
          }
          const metadata = warning.metadataJson as Record<string, unknown> | null;
          const symbol = typeof metadata?.symbol === "string" ? metadata.symbol.toUpperCase() : null;
          if (warning.instrumentId && scopedInstrumentIds.has(warning.instrumentId)) {
            return true;
          }
          if (symbol && scopedSymbols.has(symbol)) {
            return true;
          }
          return false;
        })
        .map((warning) => {
          const metadata = warning.metadataJson as Record<string, unknown> | null;
          return {
            code: warning.code,
            severity: warning.severity,
            accountId: warning.accountId,
            instrumentId: warning.instrumentId,
            date: warning.date.toISOString().slice(0, 10),
            resolvedAt: warning.resolvedAt?.toISOString().slice(0, 10) ?? null,
            message: typeof metadata?.message === "string" ? metadata.message : null,
            symbol: typeof metadata?.symbol === "string" ? metadata.symbol : null,
          };
        }),
    },
  };
}
