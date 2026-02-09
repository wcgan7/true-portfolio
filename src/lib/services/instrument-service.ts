import { prisma } from "@/src/lib/db";
import { DomainValidationError } from "@/src/lib/errors";
import type { CreateInstrumentInput } from "@/src/lib/schemas/instrument";

export async function createInstrument(input: CreateInstrumentInput) {
  const existing = await prisma.instrument.findFirst({
    where: {
      symbol: input.symbol,
      kind: input.kind,
    },
    select: { id: true },
  });
  if (existing) {
    throw new DomainValidationError(
      `Instrument ${input.symbol} (${input.kind}) already exists`,
    );
  }

  return prisma.instrument.create({
    data: {
      symbol: input.symbol,
      name: input.name,
      kind: input.kind,
      currency: input.currency,
    },
  });
}

export async function listInstruments() {
  return prisma.instrument.findMany({
    orderBy: [{ kind: "asc" }, { symbol: "asc" }],
  });
}

