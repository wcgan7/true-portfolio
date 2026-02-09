import { prisma } from "@/src/lib/db";
import type { CreateAccountInput } from "@/src/lib/schemas/account";

export async function createAccount(input: CreateAccountInput) {
  return prisma.account.create({
    data: {
      name: input.name,
      baseCurrency: input.baseCurrency,
    },
  });
}

export async function listAccounts() {
  return prisma.account.findMany({
    orderBy: { createdAt: "asc" },
  });
}

