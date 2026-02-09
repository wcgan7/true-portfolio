import { prisma } from "@/src/lib/db";
import { DomainValidationError } from "@/src/lib/errors";
import { addUtcDays, dateRangeUtcInclusive, startOfYearUtc, toUtcDateOnly } from "@/src/lib/time/date";
import { getValuationSnapshotCore } from "@/src/lib/services/valuation-core";

export type PerformancePeriod = "since_inception" | "ytd" | "custom";

export type PerformanceMetrics = {
  period: {
    type: PerformancePeriod;
    startDate: string;
    endDate: string;
  };
  mwr: number | null;
  twr: number | null;
};

type CashflowPoint = { date: Date; amount: number };

function toNumber(value: unknown): number {
  return Number(value);
}

function yearFraction(a: Date, b: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return (b.getTime() - a.getTime()) / msPerDay / 365;
}

function xnpv(rate: number, flows: CashflowPoint[]): number {
  const t0 = flows[0].date;
  return flows.reduce((sum, flow) => sum + flow.amount / (1 + rate) ** yearFraction(t0, flow.date), 0);
}

function dxnpv(rate: number, flows: CashflowPoint[]): number {
  const t0 = flows[0].date;
  return flows.reduce((sum, flow) => {
    const yf = yearFraction(t0, flow.date);
    if (yf === 0) {
      return sum;
    }
    return sum - (yf * flow.amount) / (1 + rate) ** (yf + 1);
  }, 0);
}

function solveXirr(flows: CashflowPoint[]): number | null {
  const positives = flows.some((f) => f.amount > 0);
  const negatives = flows.some((f) => f.amount < 0);
  if (!positives || !negatives) {
    return null;
  }

  let rate = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = xnpv(rate, flows);
    const df = dxnpv(rate, flows);
    if (Math.abs(df) < 1e-12) {
      break;
    }
    const next = rate - f / df;
    if (!Number.isFinite(next) || next <= -0.9999 || next > 1e18) {
      break;
    }
    if (Math.abs(next - rate) < 1e-10) {
      return next;
    }
    rate = next;
  }

  // Bisection fallback on a wide interval.
  let lo = -0.9999;
  let hi = 1e18;
  let fLo = xnpv(lo, flows);
  let fHi = xnpv(hi, flows);
  if (fLo * fHi > 0) {
    return null;
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fMid = xnpv(mid, flows);
    if (Math.abs(fMid) < 1e-9) {
      return mid;
    }
    if (fLo * fMid <= 0) {
      hi = mid;
      fHi = fMid;
    } else {
      lo = mid;
      fLo = fMid;
    }
    if (Math.abs(hi - lo) < 1e-10) {
      return (lo + hi) / 2;
    }
  }
  return null;
}

async function resolvePeriodBounds(params: {
  accountId?: string;
  period: PerformancePeriod;
  asOfDate: Date;
  customFrom?: Date;
  customTo?: Date;
}): Promise<{ startDate: Date; endDate: Date }> {
  const endDate = toUtcDateOnly(params.asOfDate);
  if (params.period === "custom") {
    if (!params.customFrom || !params.customTo) {
      throw new DomainValidationError("custom period requires from and to");
    }
    const from = toUtcDateOnly(params.customFrom);
    const to = toUtcDateOnly(params.customTo);
    if (from > to) {
      throw new DomainValidationError("custom period requires from <= to");
    }
    if (to > endDate) {
      throw new DomainValidationError("custom period to must be <= asOfDate");
    }
    return { startDate: from, endDate: to };
  }

  if (params.period === "ytd") {
    return { startDate: startOfYearUtc(endDate), endDate };
  }

  const firstTx = await prisma.transaction.findFirst({
    where: params.accountId ? { accountId: params.accountId } : undefined,
    orderBy: { tradeDate: "asc" },
    select: { tradeDate: true },
  });
  const startDate = firstTx ? toUtcDateOnly(firstTx.tradeDate) : endDate;
  return { startDate, endDate };
}

async function getExternalFlowsByDate(params: {
  accountId?: string;
  startDate: Date;
  endDate: Date;
}) {
  const rows = await prisma.transaction.findMany({
    where: {
      ...(params.accountId ? { accountId: params.accountId } : {}),
      tradeDate: { gte: params.startDate, lte: params.endDate },
      type: { in: ["DEPOSIT", "WITHDRAWAL"] },
    },
    select: {
      tradeDate: true,
      type: true,
      amount: true,
    },
  });

  const flows = new Map<string, number>();
  for (const row of rows) {
    const dateKey = toUtcDateOnly(row.tradeDate).toISOString().slice(0, 10);
    const delta = row.type === "DEPOSIT" ? toNumber(row.amount) : -toNumber(row.amount);
    flows.set(dateKey, (flows.get(dateKey) ?? 0) + delta);
  }
  return flows;
}

export async function getPerformanceMetrics(params?: {
  accountId?: string;
  period?: PerformancePeriod;
  asOfDate?: Date;
  from?: Date;
  to?: Date;
}): Promise<PerformanceMetrics> {
  const period = params?.period ?? "since_inception";
  const asOfDate = toUtcDateOnly(params?.asOfDate ?? new Date());
  const { startDate, endDate } = await resolvePeriodBounds({
    accountId: params?.accountId,
    period,
    asOfDate,
    customFrom: params?.from,
    customTo: params?.to,
  });

  const startMinusOne = addUtcDays(startDate, -1);
  const startVal = (
    await getValuationSnapshotCore({
      accountId: params?.accountId,
      asOfDate: startMinusOne,
    })
  ).totals.totalValue;
  const endVal = (
    await getValuationSnapshotCore({
      accountId: params?.accountId,
      asOfDate: endDate,
    })
  ).totals.totalValue;
  const externalFlows = await getExternalFlowsByDate({
    accountId: params?.accountId,
    startDate,
    endDate,
  });

  const mwrFlows: CashflowPoint[] = [{ date: startDate, amount: -startVal }];
  for (const date of dateRangeUtcInclusive(startDate, endDate)) {
    const key = date.toISOString().slice(0, 10);
    const flow = externalFlows.get(key) ?? 0;
    if (Math.abs(flow) > 1e-9) {
      // Investor perspective: deposits are outflows, withdrawals inflows.
      mwrFlows.push({ date, amount: -flow });
    }
  }
  mwrFlows.push({ date: endDate, amount: endVal });
  const mwr = solveXirr(mwrFlows);

  let chain = 1;
  let prevValue = startVal;
  for (const date of dateRangeUtcInclusive(startDate, endDate)) {
    const key = date.toISOString().slice(0, 10);
    const flow = externalFlows.get(key) ?? 0;
    const currValue = (
      await getValuationSnapshotCore({
        accountId: params?.accountId,
        asOfDate: date,
      })
    ).totals.totalValue;

    let dailyReturn = 0;
    if (Math.abs(prevValue) > 1e-9) {
      dailyReturn = (currValue - prevValue - flow) / prevValue;
    } else if (Math.abs(currValue - flow) <= 1e-9) {
      dailyReturn = 0;
    }
    chain *= 1 + dailyReturn;
    prevValue = currValue;
  }
  const twr = chain - 1;

  return {
    period: {
      type: period,
      startDate: startDate.toISOString().slice(0, 10),
      endDate: endDate.toISOString().slice(0, 10),
    },
    mwr,
    twr,
  };
}
