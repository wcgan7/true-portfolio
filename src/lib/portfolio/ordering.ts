export type ReplaySortableTransaction = {
  id: string;
  tradeDate: Date;
  createdAt: Date;
};

export function sortTransactionsForReplay<T extends ReplaySortableTransaction>(
  transactions: T[],
): T[] {
  return [...transactions].sort((a, b) => {
    const tradeDateDiff = a.tradeDate.getTime() - b.tradeDate.getTime();
    if (tradeDateDiff !== 0) {
      return tradeDateDiff;
    }

    const createdAtDiff = a.createdAt.getTime() - b.createdAt.getTime();
    if (createdAtDiff !== 0) {
      return createdAtDiff;
    }

    return a.id.localeCompare(b.id);
  });
}

