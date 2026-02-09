import { prisma } from "@/src/lib/db";
import { DomainValidationError } from "@/src/lib/errors";
import { dateRangeUtcInclusive, toUtcDateOnly } from "@/src/lib/time/date";
import { getValuationSnapshotCore } from "@/src/lib/services/valuation-core";

export type RecomputeValuationsResult = {
  from: string;
  to: string;
  datesProcessed: number;
  rowsUpserted: number;
  portfolioRowsUpserted: number;
  accountRowsUpserted: number;
};

function isCompleteForSnapshot(snapshot: Awaited<ReturnType<typeof getValuationSnapshotCore>>): boolean {
  return !snapshot.warnings.some((warning) => warning.code === "MISSING_PRICE");
}

async function upsertDailyValuation(params: {
  date: Date;
  accountId: string | null;
  cashValue: number;
  marketValue: number;
  totalValue: number;
  completenessFlag: boolean;
}) {
  const existing = await prisma.dailyValuation.findFirst({
    where: {
      date: params.date,
      accountId: params.accountId,
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.dailyValuation.update({
      where: { id: existing.id },
      data: {
        cashValue: params.cashValue,
        marketValue: params.marketValue,
        totalValue: params.totalValue,
        completenessFlag: params.completenessFlag,
      },
    });
    return;
  }

  await prisma.dailyValuation.create({
    data: {
      date: params.date,
      accountId: params.accountId,
      cashValue: params.cashValue,
      marketValue: params.marketValue,
      totalValue: params.totalValue,
      completenessFlag: params.completenessFlag,
    },
  });
}

async function resolveBounds(params: { accountId?: string; from?: Date; to?: Date }) {
  const from = params.from ? toUtcDateOnly(params.from) : undefined;
  const to = params.to ? toUtcDateOnly(params.to) : undefined;

  if (from && to && from > to) {
    throw new DomainValidationError("from must be <= to");
  }

  const firstTx = await prisma.transaction.findFirst({
    where: params.accountId ? { accountId: params.accountId } : undefined,
    orderBy: { tradeDate: "asc" },
    select: { tradeDate: true },
  });

  const fallback = toUtcDateOnly(new Date());
  const resolvedFrom = from ?? (firstTx ? toUtcDateOnly(firstTx.tradeDate) : to ?? fallback);
  const resolvedTo = to ?? fallback;

  if (resolvedFrom > resolvedTo) {
    throw new DomainValidationError("from must be <= to");
  }

  return { from: resolvedFrom, to: resolvedTo };
}

export async function recomputeDailyValuations(params?: {
  accountId?: string;
  from?: Date;
  to?: Date;
}): Promise<RecomputeValuationsResult> {
  if (params?.accountId) {
    const account = await prisma.account.findUnique({
      where: { id: params.accountId },
      select: { id: true },
    });
    if (!account) {
      throw new DomainValidationError(`Account ${params.accountId} does not exist`);
    }
  }

  const bounds = await resolveBounds({
    accountId: params?.accountId,
    from: params?.from,
    to: params?.to,
  });

  const dates = dateRangeUtcInclusive(bounds.from, bounds.to);
  let portfolioRowsUpserted = 0;
  let accountRowsUpserted = 0;

  const accountIds = params?.accountId
    ? [params.accountId]
    : (await prisma.account.findMany({ select: { id: true } })).map((account) => account.id);

  for (const date of dates) {
    if (!params?.accountId) {
      const portfolio = await getValuationSnapshotCore({ asOfDate: date });
      await upsertDailyValuation({
        date,
        accountId: null,
        cashValue: portfolio.totals.cashValue,
        marketValue: portfolio.totals.marketValue,
        totalValue: portfolio.totals.totalValue,
        completenessFlag: isCompleteForSnapshot(portfolio),
      });
      portfolioRowsUpserted += 1;
    }

    for (const accountId of accountIds) {
      const snapshot = await getValuationSnapshotCore({
        asOfDate: date,
        accountId,
      });
      await upsertDailyValuation({
        date,
        accountId,
        cashValue: snapshot.totals.cashValue,
        marketValue: snapshot.totals.marketValue,
        totalValue: snapshot.totals.totalValue,
        completenessFlag: isCompleteForSnapshot(snapshot),
      });
      accountRowsUpserted += 1;
    }
  }

  return {
    from: bounds.from.toISOString().slice(0, 10),
    to: bounds.to.toISOString().slice(0, 10),
    datesProcessed: dates.length,
    rowsUpserted: portfolioRowsUpserted + accountRowsUpserted,
    portfolioRowsUpserted,
    accountRowsUpserted,
  };
}

export async function listDailyValuations(params?: {
  accountId?: string;
  from?: Date;
  to?: Date;
}) {
  const from = params?.from ? toUtcDateOnly(params.from) : undefined;
  const to = params?.to ? toUtcDateOnly(params.to) : undefined;

  if (from && to && from > to) {
    throw new DomainValidationError("from must be <= to");
  }

  return prisma.dailyValuation.findMany({
    where: {
      ...(params?.accountId ? { accountId: params.accountId } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ date: "asc" }, { accountId: "asc" }],
  });
}
