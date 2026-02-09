import { NextResponse } from "next/server";

import { DomainValidationError } from "@/src/lib/errors";
import { getOverviewSnapshot } from "@/src/lib/services/overview-service";
import type { PerformancePeriod } from "@/src/lib/services/performance-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get("accountId") ?? undefined;
    const asOfDateParam = url.searchParams.get("asOfDate");
    const periodParam = (url.searchParams.get("period") ?? "since_inception") as PerformancePeriod;
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

    const snapshot = await getOverviewSnapshot({
      accountId,
      asOfDate,
      period: periodParam,
      from,
      to,
    });
    return NextResponse.json({ data: snapshot });
  } catch (error) {
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
