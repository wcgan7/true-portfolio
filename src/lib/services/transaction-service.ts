import { prisma } from "@/src/lib/db";
import { DomainValidationError } from "@/src/lib/errors";
import { sortTransactionsForReplay } from "@/src/lib/portfolio/ordering";
import type { CreateTransactionInput } from "@/src/lib/schemas/transaction";

type PositionTransaction = {
  id: string;
  type: "BUY" | "SELL";
  quantity: number;
  tradeDate: Date;
  createdAt: Date;
};

function toNumber(value: unknown): number {
  return Number(value);
}

async function assertAccountExists(accountId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { id: true },
  });
  if (!account) {
    throw new DomainValidationError(`Account ${accountId} does not exist`);
  }
}

async function assertInstrumentValidForTrade(instrumentId: string) {
  const instrument = await prisma.instrument.findUnique({
    where: { id: instrumentId },
    select: { id: true, kind: true },
  });
  if (!instrument) {
    throw new DomainValidationError(`Instrument ${instrumentId} does not exist`);
  }
  if (instrument.kind === "CASH") {
    throw new DomainValidationError("BUY/SELL does not support CASH instruments");
  }
}

async function assertExternalRefUnique(params: {
  accountId: string;
  externalRef?: string;
  excludeTransactionId?: string;
}) {
  if (!params.externalRef) {
    return;
  }

  const existing = await prisma.transaction.findFirst({
    where: {
      accountId: params.accountId,
      externalRef: params.externalRef,
      ...(params.excludeTransactionId ? { id: { not: params.excludeTransactionId } } : {}),
    },
    select: { id: true },
  });

  if (existing) {
    throw new DomainValidationError(
      `Duplicate externalRef '${params.externalRef}' for account ${params.accountId}`,
    );
  }
}

async function assertNoNegativePosition(params: {
  accountId: string;
  instrumentId: string;
  excludeTransactionId?: string;
  candidateTransaction?: PositionTransaction;
}) {
  const rows = await prisma.transaction.findMany({
    where: {
      accountId: params.accountId,
      instrumentId: params.instrumentId,
      type: { in: ["BUY", "SELL"] },
      ...(params.excludeTransactionId ? { id: { not: params.excludeTransactionId } } : {}),
    },
    select: {
      id: true,
      type: true,
      quantity: true,
      tradeDate: true,
      createdAt: true,
    },
  });

  const replay = rows
    .map((row) => ({
      id: row.id,
      type: row.type,
      quantity: toNumber(row.quantity),
      tradeDate: row.tradeDate,
      createdAt: row.createdAt,
    }))
    .concat(params.candidateTransaction ? [params.candidateTransaction] : []);

  const sorted = sortTransactionsForReplay(replay);
  let quantity = 0;

  for (const tx of sorted) {
    quantity += tx.type === "BUY" ? tx.quantity : -tx.quantity;
    if (quantity < -1e-9) {
      throw new DomainValidationError(
        `Transaction would create negative position for instrument ${params.instrumentId}`,
      );
    }
  }
}

export async function createTransaction(input: CreateTransactionInput) {
  await assertAccountExists(input.accountId);
  await assertExternalRefUnique({
    accountId: input.accountId,
    externalRef: input.externalRef,
  });

  if ((input.type === "BUY" || input.type === "SELL") && input.instrumentId) {
    await assertInstrumentValidForTrade(input.instrumentId);
    await assertNoNegativePosition({
      accountId: input.accountId,
      instrumentId: input.instrumentId,
      candidateTransaction: {
        id: `new-${Date.now()}`,
        type: input.type,
        quantity: input.quantity!,
        tradeDate: input.tradeDate,
        createdAt: new Date(),
      },
    });
  }

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

export async function updateTransaction(id: string, input: CreateTransactionInput) {
  const existing = await prisma.transaction.findUnique({ where: { id } });
  if (!existing) {
    throw new DomainValidationError("Transaction not found");
  }
  await assertAccountExists(input.accountId);
  await assertExternalRefUnique({
    accountId: input.accountId,
    externalRef: input.externalRef,
    excludeTransactionId: id,
  });

  if ((input.type === "BUY" || input.type === "SELL") && input.instrumentId) {
    await assertInstrumentValidForTrade(input.instrumentId);
    await assertNoNegativePosition({
      accountId: input.accountId,
      instrumentId: input.instrumentId,
      excludeTransactionId: id,
      candidateTransaction: {
        id,
        type: input.type,
        quantity: input.quantity!,
        tradeDate: input.tradeDate,
        createdAt: existing.createdAt,
      },
    });
  }

  return prisma.transaction.update({
    where: { id },
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
}

export async function listTransactions(params?: {
  accountId?: string;
  from?: Date;
  to?: Date;
}) {
  const from = params?.from;
  const to = params?.to;
  if (from && to && from > to) {
    throw new DomainValidationError("from must be <= to");
  }

  const rows = await prisma.transaction.findMany({
    where: {
      ...(params?.accountId ? { accountId: params.accountId } : {}),
      ...(from || to
        ? {
            tradeDate: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: to } : {}),
            },
          }
        : {}),
    },
  });

  return sortTransactionsForReplay(rows);
}
