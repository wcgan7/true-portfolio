import { prisma } from "@/src/lib/db";
import { DomainValidationError } from "@/src/lib/errors";
import type { RefreshPricesInput } from "@/src/lib/schemas/price-refresh";
import { toUtcDateOnly } from "@/src/lib/time/date";

type PolygonAggResponse = {
  results?: Array<{
    t: number;
    c: number;
  }>;
  status?: string;
  error?: string;
};

export type PriceRefreshResult = {
  requestedSymbols: string[];
  processedSymbols: string[];
  missingSymbols: string[];
  pointsUpserted: number;
};

function formatDate(date: Date): string {
  return toUtcDateOnly(date).toISOString().slice(0, 10);
}

async function fetchPolygonDailyAggs(params: {
  symbol: string;
  from: Date;
  to: Date;
}): Promise<Array<{ date: Date; close: number }>> {
  const apiKey = process.env.POLYGON_API_KEY;
  if (!apiKey) {
    throw new DomainValidationError("POLYGON_API_KEY is not configured");
  }

  const from = formatDate(params.from);
  const to = formatDate(params.to);
  const url = new URL(
    `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(params.symbol)}/range/1/day/${from}/${to}`,
  );
  url.searchParams.set("adjusted", "true");
  url.searchParams.set("sort", "asc");
  url.searchParams.set("limit", "50000");
  url.searchParams.set("apiKey", apiKey);

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new DomainValidationError(
      `Polygon request failed for ${params.symbol}: ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as PolygonAggResponse;
  if (payload.status === "ERROR") {
    throw new DomainValidationError(payload.error ?? `Polygon returned error for ${params.symbol}`);
  }

  return (payload.results ?? []).map((item) => ({
    date: new Date(item.t),
    close: item.c,
  }));
}

export async function refreshPrices(input: RefreshPricesInput): Promise<PriceRefreshResult> {
  const today = new Date();
  const from = toUtcDateOnly(input.from ?? today);
  const to = toUtcDateOnly(input.to ?? today);
  if (from > to) {
    throw new DomainValidationError("from must be <= to");
  }

  const whereSymbols = input.symbols?.length
    ? { symbol: { in: input.symbols.map((symbol) => symbol.toUpperCase()) } }
    : {};

  const instruments = await prisma.instrument.findMany({
    where: {
      ...whereSymbols,
      kind: { in: ["STOCK", "ETF"] },
      isActive: true,
    },
    select: { id: true, symbol: true },
  });

  const requestedSymbols = input.symbols?.length
    ? input.symbols.map((s) => s.toUpperCase())
    : [...new Set(instruments.map((instrument) => instrument.symbol))];
  const processedSymbols: string[] = [];
  let pointsUpserted = 0;

  for (const instrument of instruments) {
    const points = await fetchPolygonDailyAggs({
      symbol: instrument.symbol,
      from,
      to,
    });
    for (const point of points) {
      await prisma.pricePoint.upsert({
        where: {
          instrumentId_date_source: {
            instrumentId: instrument.id,
            date: toUtcDateOnly(point.date),
            source: "polygon",
          },
        },
        update: {
          close: point.close,
          fetchedAt: new Date(),
        },
        create: {
          instrumentId: instrument.id,
          date: toUtcDateOnly(point.date),
          close: point.close,
          source: "polygon",
        },
      });
      pointsUpserted += 1;
    }
    processedSymbols.push(instrument.symbol);
  }

  const missingSymbols = requestedSymbols.filter((symbol) => !processedSymbols.includes(symbol));

  return {
    requestedSymbols,
    processedSymbols,
    missingSymbols,
    pointsUpserted,
  };
}

