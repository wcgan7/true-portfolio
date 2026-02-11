import type { ValuationEngine } from "@/src/lib/engines/interfaces";
import { getValuationSnapshotCore } from "@/src/lib/services/valuation-core";

export const tsValuationEngine: ValuationEngine = {
  getSnapshot: getValuationSnapshotCore,
};
