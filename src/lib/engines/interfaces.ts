import type {
  PerformanceMetrics,
  PerformancePeriod,
} from "@/src/lib/services/performance-service";
import type {
  OverviewHolding,
  OverviewWarning,
  ValuationSnapshotCore,
} from "@/src/lib/services/valuation-core";
import type {
  ClassificationBreakdown,
  LookThroughMeta,
} from "@/src/lib/services/overview-types";

export interface ValuationEngine {
  getSnapshot(params?: { accountId?: string; asOfDate?: Date }): Promise<ValuationSnapshotCore>;
}

export interface PerformanceEngine {
  getMetrics(params?: {
    accountId?: string;
    period?: PerformancePeriod;
    asOfDate?: Date;
    from?: Date;
    to?: Date;
  }): Promise<PerformanceMetrics>;
}

export interface ExposureEngine {
  applyLookThrough(params: {
    holdings: OverviewHolding[];
    asOfDate: string;
  }): Promise<{
    holdings: OverviewHolding[];
    warnings: OverviewWarning[];
    meta: LookThroughMeta;
  }>;

  buildClassificationBreakdown(params: {
    holdings: OverviewHolding[];
    totalValue: number;
  }): Promise<{
    classifications: ClassificationBreakdown;
    warnings: OverviewWarning[];
  }>;
}

export type PortfolioEngines = {
  valuationEngine: ValuationEngine;
  performanceEngine: PerformanceEngine;
  exposureEngine: ExposureEngine;
};
