import type { PerformanceEngine } from "@/src/lib/engines/interfaces";
import { getPerformanceMetrics } from "@/src/lib/services/performance-service";

export const tsPerformanceEngine: PerformanceEngine = {
  getMetrics: getPerformanceMetrics,
};
