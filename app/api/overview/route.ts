import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getDefaultPortfolioEngines } from "@/src/lib/engines/default-engines";
import { DomainValidationError } from "@/src/lib/errors";
import { overviewQuerySchema } from "@/src/lib/schemas/overview-query";
import { getOverviewSnapshot } from "@/src/lib/services/overview-service";
import type { OverviewHolding } from "@/src/lib/services/valuation-core";

function parseListParam(url: URL, key: string): string[] {
  const raw = url.searchParams.getAll(key);
  return raw
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = overviewQuerySchema.parse({
      accountId: url.searchParams.get("accountId") ?? undefined,
      asOfDate: url.searchParams.get("asOfDate") ?? undefined,
      mode: url.searchParams.get("mode") ?? undefined,
      period: url.searchParams.get("period") ?? undefined,
      assetKinds: parseListParam(url, "assetKind"),
      currencies: parseListParam(url, "currency"),
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    const snapshot = await getOverviewSnapshot({
      accountId: query.accountId,
      asOfDate: query.asOfDate,
      mode: query.mode,
      period: query.period,
      from: query.from,
      to: query.to,
      assetKinds: query.assetKinds as OverviewHolding["kind"][],
      currencies: query.currencies,
      engines: getDefaultPortfolioEngines(),
    });
    return NextResponse.json({ data: snapshot });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid query params." }, { status: 400 });
    }
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
