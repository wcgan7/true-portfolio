import { prisma } from "@/src/lib/db";
import { DomainValidationError } from "@/src/lib/errors";
import type { IngestEtfConstituentsInput } from "@/src/lib/schemas/etf-constituent-ingest";
import { toUtcDateOnly } from "@/src/lib/time/date";

export type EtfConstituentIngestResult = {
  asOfDate: string;
  source: string;
  replaceExistingAsOfDate: boolean;
  etfsProcessed: string[];
  rowsInserted: number;
  rowsReceived: number;
};

export async function ingestEtfConstituents(
  input: IngestEtfConstituentsInput,
): Promise<EtfConstituentIngestResult> {
  const asOfDate = toUtcDateOnly(input.asOfDate);
  const rows = input.rows.map((row) => ({
    etfSymbol: row.etfSymbol.toUpperCase(),
    constituentSymbol: row.constituentSymbol.toUpperCase(),
    weight: row.weight,
  }));
  const etfSymbols = [...new Set(rows.map((row) => row.etfSymbol))];

  const etfRows = await prisma.instrument.findMany({
    where: {
      symbol: { in: etfSymbols },
      kind: "ETF",
    },
    select: {
      id: true,
      symbol: true,
    },
  });
  const etfBySymbol = new Map(etfRows.map((row) => [row.symbol.toUpperCase(), row]));

  const missingEtfs = etfSymbols.filter((symbol) => !etfBySymbol.has(symbol));
  if (missingEtfs.length > 0) {
    throw new DomainValidationError(
      `ETF instruments not found for symbols: ${missingEtfs.join(", ")}`,
    );
  }

  const deduped = new Map<string, { etfInstrumentId: string; constituentSymbol: string; weight: number }>();
  for (const row of rows) {
    const etf = etfBySymbol.get(row.etfSymbol);
    if (!etf) {
      continue;
    }
    const key = `${etf.id}:${row.constituentSymbol}`;
    deduped.set(key, {
      etfInstrumentId: etf.id,
      constituentSymbol: row.constituentSymbol,
      weight: row.weight,
    });
  }

  await prisma.$transaction(async (tx) => {
    if (input.replaceExistingAsOfDate) {
      await tx.etfConstituent.deleteMany({
        where: {
          etfInstrumentId: { in: etfRows.map((row) => row.id) },
          asOfDate,
        },
      });
    }

    const inserts = [...deduped.values()];
    if (inserts.length > 0) {
      await tx.etfConstituent.createMany({
        data: inserts.map((row) => ({
          etfInstrumentId: row.etfInstrumentId,
          constituentSymbol: row.constituentSymbol,
          weight: row.weight,
          asOfDate,
          source: input.source,
        })),
      });
    }
  });

  return {
    asOfDate: asOfDate.toISOString().slice(0, 10),
    source: input.source,
    replaceExistingAsOfDate: input.replaceExistingAsOfDate,
    etfsProcessed: etfSymbols,
    rowsInserted: deduped.size,
    rowsReceived: rows.length,
  };
}
