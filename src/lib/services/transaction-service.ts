import { prisma } from "@/src/lib/db";
import { sortTransactionsForReplay } from "@/src/lib/portfolio/ordering";
import type { CreateTransactionInput } from "@/src/lib/schemas/transaction";

export async function createTransaction(input: CreateTransactionInput) {
  const created = await prisma.transaction.create({
    data: {
      accountId: input.accountId,
      instrumentId: input.instrumentId,
      type: input.type,
      tradeDate: input.tradeDate,
      settleDate: input.settleDate,
      quantity: input.quantity,
      price: input.price,
      amount: input.amount ?? input.quantity! * input.price!,
      feeAmount: input.feeAmount,
      notes: input.notes,
      externalRef: input.externalRef,
    },
  });

  return created;
}

export async function listTransactions(accountId?: string) {
  const rows = await prisma.transaction.findMany({
    where: accountId ? { accountId } : undefined,
  });

  return sortTransactionsForReplay(rows);
}

