import { prisma } from "@/src/lib/db";
import { DomainValidationError } from "@/src/lib/errors";
import { cashDeltaForTransaction } from "@/src/lib/portfolio/ledger";
import { getOverviewSnapshot, type OverviewMode } from "@/src/lib/services/overview-service";
import { toUtcDateOnly } from "@/src/lib/time/date";

export type AuditMetric =
  | "totalValue"
  | "marketValue"
  | "cashValue"
  | "realizedPnl"
  | "unrealizedPnl"
  | "mwr"
  | "twr";

export type MetricAuditPayload = {
  metric: AuditMetric;
  asOfDate: string;
  accountId: string | null;
  mode: OverviewMode;
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

function toNumber(value: unknown): number {
  return Number(value);
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
}): Promise<MetricAuditPayload> {
  if (!ALLOWED_METRICS.includes(params.metric as AuditMetric)) {
    throw new DomainValidationError(
      "Invalid metric. Use totalValue, marketValue, cashValue, realizedPnl, unrealizedPnl, mwr, or twr.",
    );
  }

  const metric = params.metric as AuditMetric;
  const asOfDate = toUtcDateOnly(params.asOfDate ?? new Date());
  const mode = params.mode ?? "raw";

  const snapshot = await getOverviewSnapshot({
    accountId: params.accountId,
    asOfDate,
    mode,
  });

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
    value: metricValue(snapshot, metric),
    contributors: {
      holdings: snapshot.holdings.map((holding) => ({
        accountId: holding.accountId,
        instrumentId: holding.instrumentId,
        symbol: holding.symbol,
        kind: holding.kind,
        marketValue: holding.marketValue,
        portfolioWeightPct: holding.portfolioWeightPct,
      })),
      transactions: txRows.map((row) => ({
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
      warnings: warningRows.map((warning) => {
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
