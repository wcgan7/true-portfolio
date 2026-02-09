import {
  type PerformanceMetrics,
  type PerformancePeriod,
  getPerformanceMetrics,
} from "@/src/lib/services/performance-service";
import {
  type OverviewHolding,
  type OverviewWarning,
  getValuationSnapshotCore,
} from "@/src/lib/services/valuation-core";

export type OverviewSnapshot = {
  asOfDate: string;
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
};

export async function getOverviewSnapshot(params?: {
  accountId?: string;
  asOfDate?: Date;
  period?: PerformancePeriod;
  from?: Date;
  to?: Date;
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

  return {
    asOfDate: valuation.asOfDate,
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
    holdings: valuation.holdings,
    warnings: valuation.warnings,
  };
}

