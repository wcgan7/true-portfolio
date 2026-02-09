import { prisma } from "@/src/lib/db";
import { sortTransactionsForReplay } from "@/src/lib/portfolio/ordering";
import { replayTransactions } from "@/src/lib/portfolio/replay";

export type OverviewWarningCode =
  | "MISSING_PRICE"
  | "STALE_PRICE_FALLBACK"
  | "NEGATIVE_CASH"
  | "UNKNOWN_TICKER"
  | "UNCLASSIFIED_EXPOSURE"
  | "ETF_LOOKTHROUGH_UNAVAILABLE"
  | "ETF_LOOKTHROUGH_STALE";

export type OverviewWarning = {
  code: OverviewWarningCode;
  message: string;
  accountId?: string;
  instrumentId: string | null;
  symbol: string;
};

export type OverviewHolding = {
  accountId: string;
  instrumentId: string | null;
  symbol: string;
  kind: "CASH" | "STOCK" | "ETF" | "OPTION" | "CUSTOM";
  quantity: number;
  marketValue: number;
  portfolioWeightPct: number;
  costBasis: number;
  unrealizedPnl: number;
  realizedPnl: number;
};

export type ValuationSnapshotCore = {
  asOfDate: string;
  totals: {
    cashValue: number;
    marketValue: number;
    totalValue: number;
    realizedPnl: number;
    unrealizedPnl: number;
  };
  holdings: OverviewHolding[];
  warnings: OverviewWarning[];
};

function toNumber(value: unknown): number {
  return Number(value);
}

export async function getValuationSnapshotCore(params?: {
  accountId?: string;
  asOfDate?: Date;
}): Promise<ValuationSnapshotCore> {
  const asOfDate = params?.asOfDate ?? new Date();
  const txRows = await prisma.transaction.findMany({
    where: {
      ...(params?.accountId ? { accountId: params.accountId } : {}),
      tradeDate: { lte: asOfDate },
    },
  });

  const replayInput = sortTransactionsForReplay(txRows).map((row) => ({
    id: row.id,
    accountId: row.accountId,
    instrumentId: row.instrumentId,
    type: row.type,
    tradeDate: row.tradeDate,
    quantity: row.quantity == null ? null : toNumber(row.quantity),
    price: row.price == null ? null : toNumber(row.price),
    amount: toNumber(row.amount),
    feeAmount: toNumber(row.feeAmount),
  }));

  const replay = replayTransactions(replayInput);
  const instrumentIds = [...new Set(replay.positions.map((position) => position.instrumentId))];
  const instruments = instrumentIds.length
    ? await prisma.instrument.findMany({ where: { id: { in: instrumentIds } } })
    : [];
  const instrumentById = new Map(instruments.map((instrument) => [instrument.id, instrument]));

  const warnings: OverviewWarning[] = [];
  const holdings: OverviewHolding[] = [];
  let marketValue = 0;
  let unrealizedPnl = 0;

  for (const position of replay.positions) {
    const instrument = instrumentById.get(position.instrumentId);
    if (!instrument) {
      continue;
    }

    const latestPrice = await prisma.pricePoint.findFirst({
      where: {
        instrumentId: position.instrumentId,
        date: { lte: asOfDate },
      },
      orderBy: { date: "desc" },
    });

    let price = 0;
    if (!latestPrice) {
      warnings.push({
        code: "MISSING_PRICE",
        message: `Missing price for ${instrument.symbol} on or before ${asOfDate.toISOString().slice(0, 10)}`,
        accountId: position.accountId,
        instrumentId: instrument.id,
        symbol: instrument.symbol,
      });
    } else {
      price = toNumber(latestPrice.close);
      if (latestPrice.date.toISOString().slice(0, 10) !== asOfDate.toISOString().slice(0, 10)) {
        warnings.push({
          code: "STALE_PRICE_FALLBACK",
          message: `Using stale price for ${instrument.symbol} from ${latestPrice.date.toISOString().slice(0, 10)}`,
          accountId: position.accountId,
          instrumentId: instrument.id,
          symbol: instrument.symbol,
        });
      }
    }

    const positionMarketValue = position.quantity * price;
    const positionUnrealized = positionMarketValue - position.costBasis;
    marketValue += positionMarketValue;
    unrealizedPnl += positionUnrealized;

    holdings.push({
      accountId: position.accountId,
      instrumentId: position.instrumentId,
      symbol: instrument.symbol,
      kind: instrument.kind,
      quantity: position.quantity,
      marketValue: positionMarketValue,
      portfolioWeightPct: 0,
      costBasis: position.costBasis,
      unrealizedPnl: positionUnrealized,
      realizedPnl: position.realizedPnl,
    });
  }

  const cashValue = Object.values(replay.cashByAccount).reduce((sum, value) => sum + value, 0);
  const totalValue = cashValue + marketValue;

  for (const [accountId, cash] of Object.entries(replay.cashByAccount)) {
    if (Math.abs(cash) <= 1e-9) {
      continue;
    }
    if (cash < -1e-9) {
      warnings.push({
        code: "NEGATIVE_CASH",
        message: `Negative cash balance in account ${accountId}`,
        accountId,
        instrumentId: null,
        symbol: "CASH",
      });
    }
    holdings.push({
      accountId,
      instrumentId: null,
      symbol: "CASH",
      kind: "CASH",
      quantity: 1,
      marketValue: cash,
      portfolioWeightPct: 0,
      costBasis: cash,
      unrealizedPnl: 0,
      realizedPnl: 0,
    });
  }

  const denominator = Math.abs(totalValue) <= 1e-9 ? 1 : totalValue;
  for (const holding of holdings) {
    holding.portfolioWeightPct = (holding.marketValue / denominator) * 100;
  }

  holdings.sort((a, b) => b.marketValue - a.marketValue);

  return {
    asOfDate: asOfDate.toISOString().slice(0, 10),
    totals: {
      cashValue,
      marketValue,
      totalValue,
      realizedPnl: replay.totalRealizedPnl,
      unrealizedPnl,
    },
    holdings,
    warnings,
  };
}
