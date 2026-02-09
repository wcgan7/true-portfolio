import { prisma } from "@/src/lib/db";
import type { ValuationRefreshInput } from "@/src/lib/schemas/valuation-refresh";
import { refreshPrices } from "@/src/lib/services/pricing-service";
import { recomputeDailyValuations } from "@/src/lib/services/valuation-materialization-service";

export type ValuationRefreshStatus = {
  lastPriceFetchedAt: string | null;
  lastValuationMaterializedAt: string | null;
  lastValuationDate: string | null;
};

export type ValuationRefreshRunResult = {
  price: {
    requestedSymbols: string[];
    processedSymbols: string[];
    missingSymbols: string[];
    pointsUpserted: number;
  };
  valuation: {
    from: string;
    to: string;
    datesProcessed: number;
    rowsUpserted: number;
    portfolioRowsUpserted: number;
    accountRowsUpserted: number;
  };
  status: ValuationRefreshStatus;
};

export async function getValuationRefreshStatus(): Promise<ValuationRefreshStatus> {
  const [lastPrice, lastMaterialized, lastValuationDate] = await Promise.all([
    prisma.pricePoint.findFirst({
      orderBy: { fetchedAt: "desc" },
      select: { fetchedAt: true },
    }),
    prisma.dailyValuation.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.dailyValuation.findFirst({
      orderBy: { date: "desc" },
      select: { date: true },
    }),
  ]);

  return {
    lastPriceFetchedAt: lastPrice?.fetchedAt.toISOString() ?? null,
    lastValuationMaterializedAt: lastMaterialized?.createdAt.toISOString() ?? null,
    lastValuationDate: lastValuationDate?.date.toISOString().slice(0, 10) ?? null,
  };
}

export async function runValuationRefresh(input: ValuationRefreshInput): Promise<ValuationRefreshRunResult> {
  const price = await refreshPrices({
    symbols: input.symbols,
    from: input.from,
    to: input.to,
  });

  const valuation = await recomputeDailyValuations({
    accountId: input.accountId,
    from: input.from,
    to: input.to,
  });

  const status = await getValuationRefreshStatus();

  return {
    price,
    valuation,
    status,
  };
}
