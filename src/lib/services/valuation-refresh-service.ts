import { prisma } from "@/src/lib/db";
import { ConcurrencyConflictError } from "@/src/lib/errors";
import { Pool } from "pg";
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

export const VALUATION_REFRESH_LOCK_KEYS = {
  classId: 41011,
  objectId: 1,
} as const;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}
const lockPool = new Pool({ connectionString });

async function withValuationRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const client = await lockPool.connect();
  const lockRes = await client.query<{ acquired: boolean }>(
    "SELECT pg_try_advisory_lock($1, $2) AS acquired",
    [VALUATION_REFRESH_LOCK_KEYS.classId, VALUATION_REFRESH_LOCK_KEYS.objectId],
  );
  const acquired = Boolean(lockRes.rows[0]?.acquired);

  if (!acquired) {
    client.release();
    throw new ConcurrencyConflictError("Valuation refresh is already in progress");
  }

  try {
    return await fn();
  } finally {
    await client.query("SELECT pg_advisory_unlock($1, $2)", [
      VALUATION_REFRESH_LOCK_KEYS.classId,
      VALUATION_REFRESH_LOCK_KEYS.objectId,
    ]);
    client.release();
  }
}

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
  return withValuationRefreshLock(async () => {
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
  });
}
