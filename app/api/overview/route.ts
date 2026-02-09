import { NextResponse } from "next/server";

import { DomainValidationError } from "@/src/lib/errors";
import { getOverviewSnapshot } from "@/src/lib/services/overview-service";
import type { PerformancePeriod } from "@/src/lib/services/performance-service";
import type { OverviewMode } from "@/src/lib/services/overview-service";
import type { OverviewHolding } from "@/src/lib/services/valuation-core";

const VALID_ASSET_KINDS: Array<OverviewHolding["kind"]> = ["CASH", "STOCK", "ETF", "OPTION", "CUSTOM"];

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
    const accountId = url.searchParams.get("accountId") ?? undefined;
    const asOfDateParam = url.searchParams.get("asOfDate");
    const modeParam = (url.searchParams.get("mode") ?? "raw") as OverviewMode;
    const periodParam = (url.searchParams.get("period") ?? "since_inception") as PerformancePeriod;
    const assetKindsParam = parseListParam(url, "assetKind").map((item) => item.toUpperCase());
    const currenciesParam = parseListParam(url, "currency").map((item) => item.toUpperCase());
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : undefined;
    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;

    if (asOfDateParam && Number.isNaN(asOfDate?.getTime())) {
      throw new DomainValidationError("Invalid asOfDate. Expected ISO date.");
    }
    if (fromParam && Number.isNaN(from?.getTime())) {
      throw new DomainValidationError("Invalid from. Expected ISO date.");
    }
    if (toParam && Number.isNaN(to?.getTime())) {
      throw new DomainValidationError("Invalid to. Expected ISO date.");
    }
    if (!["since_inception", "ytd", "custom"].includes(periodParam)) {
      throw new DomainValidationError("Invalid period. Use since_inception, ytd, or custom.");
    }
    if (!["raw", "lookthrough"].includes(modeParam)) {
      throw new DomainValidationError("Invalid mode. Use raw or lookthrough.");
    }
    for (const assetKind of assetKindsParam) {
      if (!VALID_ASSET_KINDS.includes(assetKind as OverviewHolding["kind"])) {
        throw new DomainValidationError("Invalid assetKind. Use CASH, STOCK, ETF, OPTION, or CUSTOM.");
      }
    }
    for (const currency of currenciesParam) {
      if (!/^[A-Z]{3}$/.test(currency)) {
        throw new DomainValidationError("Invalid currency. Expected 3-letter code like USD.");
      }
    }

    const snapshot = await getOverviewSnapshot({
      accountId,
      asOfDate,
      mode: modeParam,
      period: periodParam,
      from,
      to,
      assetKinds: assetKindsParam as OverviewHolding["kind"][],
      currencies: currenciesParam,
    });
    return NextResponse.json({ data: snapshot });
  } catch (error) {
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
