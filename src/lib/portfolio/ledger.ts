export type LedgerTransactionType =
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "FEE"
  | "DEPOSIT"
  | "WITHDRAWAL";

export type LedgerTransaction = {
  type: LedgerTransactionType;
  quantity?: number;
  price?: number;
  amount?: number;
  feeAmount?: number;
};

export function cashDeltaForTransaction(tx: LedgerTransaction): number {
  const fee = tx.feeAmount ?? 0;
  switch (tx.type) {
    case "BUY": {
      if (tx.quantity == null || tx.price == null) {
        throw new Error("BUY requires quantity and price");
      }
      return -(tx.quantity * tx.price + fee);
    }
    case "SELL": {
      if (tx.quantity == null || tx.price == null) {
        throw new Error("SELL requires quantity and price");
      }
      return tx.quantity * tx.price - fee;
    }
    case "DIVIDEND":
    case "DEPOSIT": {
      if (tx.amount == null) {
        throw new Error(`${tx.type} requires amount`);
      }
      return tx.amount;
    }
    case "FEE":
    case "WITHDRAWAL": {
      if (tx.amount == null) {
        throw new Error(`${tx.type} requires amount`);
      }
      return -tx.amount;
    }
    default: {
      const _exhaustive: never = tx.type;
      return _exhaustive;
    }
  }
}

