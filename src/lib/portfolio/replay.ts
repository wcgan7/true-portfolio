import { cashDeltaForTransaction, type LedgerTransactionType } from "@/src/lib/portfolio/ledger";

export type ReplayInputTransaction = {
  id: string;
  accountId: string;
  instrumentId: string | null;
  type: LedgerTransactionType;
  tradeDate: Date;
  quantity: number | null;
  price: number | null;
  amount: number;
  feeAmount: number;
};

export type ReplayPositionState = {
  accountId: string;
  instrumentId: string;
  quantity: number;
  costBasis: number;
  realizedPnl: number;
};

type Lot = {
  quantity: number;
  unitCost: number;
};

export type ReplayOutput = {
  cashByAccount: Record<string, number>;
  positions: ReplayPositionState[];
  totalRealizedPnl: number;
};

export function replayTransactions(transactions: ReplayInputTransaction[]): ReplayOutput {
  const cashByAccount: Record<string, number> = {};
  const lotsByPosition = new Map<string, Lot[]>();
  const realizedByPosition = new Map<string, number>();

  const positionKey = (accountId: string, instrumentId: string) => `${accountId}:${instrumentId}`;

  for (const tx of transactions) {
    const cashDelta = cashDeltaForTransaction({
      type: tx.type,
      quantity: tx.quantity ?? undefined,
      price: tx.price ?? undefined,
      amount: tx.amount,
      feeAmount: tx.feeAmount,
    });
    cashByAccount[tx.accountId] = (cashByAccount[tx.accountId] ?? 0) + cashDelta;

    if (!tx.instrumentId || (tx.type !== "BUY" && tx.type !== "SELL")) {
      if (tx.type === "DIVIDEND") {
        // Treat dividend as realized income.
        const dividendKey = positionKey(tx.accountId, "__dividend_income__");
        realizedByPosition.set(dividendKey, (realizedByPosition.get(dividendKey) ?? 0) + tx.amount);
      }
      if (tx.type === "FEE") {
        const feeKey = positionKey(tx.accountId, "__fee_expense__");
        realizedByPosition.set(feeKey, (realizedByPosition.get(feeKey) ?? 0) - tx.amount);
      }
      continue;
    }

    const key = positionKey(tx.accountId, tx.instrumentId);
    const existingLots = lotsByPosition.get(key) ?? [];

    if (tx.type === "BUY") {
      const quantity = tx.quantity ?? 0;
      const totalCost = quantity * (tx.price ?? 0) + tx.feeAmount;
      const unitCost = quantity === 0 ? 0 : totalCost / quantity;
      existingLots.push({ quantity, unitCost });
      lotsByPosition.set(key, existingLots);
      continue;
    }

    const sellQuantity = tx.quantity ?? 0;
    let remainingToClose = sellQuantity;
    let removedCost = 0;

    while (remainingToClose > 1e-9) {
      const first = existingLots[0];
      if (!first) {
        throw new Error(`Insufficient lots for SELL on ${key}`);
      }
      const matched = Math.min(first.quantity, remainingToClose);
      removedCost += matched * first.unitCost;
      first.quantity -= matched;
      remainingToClose -= matched;
      if (first.quantity <= 1e-9) {
        existingLots.shift();
      }
    }

    lotsByPosition.set(key, existingLots);
    const proceeds = sellQuantity * (tx.price ?? 0) - tx.feeAmount;
    const realizedDelta = proceeds - removedCost;
    realizedByPosition.set(key, (realizedByPosition.get(key) ?? 0) + realizedDelta);
  }

  const positions: ReplayPositionState[] = [];
  for (const [key, lots] of lotsByPosition.entries()) {
    const [accountId, instrumentId] = key.split(":");
    const quantity = lots.reduce((sum, lot) => sum + lot.quantity, 0);
    if (quantity <= 1e-9) {
      continue;
    }
    const costBasis = lots.reduce((sum, lot) => sum + lot.quantity * lot.unitCost, 0);
    positions.push({
      accountId,
      instrumentId,
      quantity,
      costBasis,
      realizedPnl: realizedByPosition.get(key) ?? 0,
    });
  }

  const totalRealizedPnl = [...realizedByPosition.values()].reduce((sum, value) => sum + value, 0);

  return {
    cashByAccount,
    positions,
    totalRealizedPnl,
  };
}

