import type { PortfolioEngines } from "@/src/lib/engines/interfaces";
import { tsExposureEngine } from "@/src/lib/engines/ts/exposure-engine";
import { tsPerformanceEngine } from "@/src/lib/engines/ts/performance-engine";
import { tsValuationEngine } from "@/src/lib/engines/ts/valuation-engine";

const defaultEngines: PortfolioEngines = {
  valuationEngine: tsValuationEngine,
  performanceEngine: tsPerformanceEngine,
  exposureEngine: tsExposureEngine,
};

export function getDefaultPortfolioEngines(): PortfolioEngines {
  return defaultEngines;
}
