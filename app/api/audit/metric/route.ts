import { NextResponse } from "next/server";

import { DomainValidationError } from "@/src/lib/errors";
import { getMetricAudit } from "@/src/lib/services/audit-service";
import type { OverviewMode } from "@/src/lib/services/overview-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const metric = url.searchParams.get("metric") ?? "";
    const accountId = url.searchParams.get("accountId") ?? undefined;
    const asOfDateParam = url.searchParams.get("asOfDate");
    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : undefined;
    const modeParam = (url.searchParams.get("mode") ?? "raw") as OverviewMode;

    if (!metric) {
      throw new DomainValidationError("metric is required");
    }
    if (asOfDateParam && Number.isNaN(asOfDate?.getTime())) {
      throw new DomainValidationError("Invalid asOfDate. Expected ISO date.");
    }
    if (![
      "raw",
      "lookthrough",
    ].includes(modeParam)) {
      throw new DomainValidationError("Invalid mode. Use raw or lookthrough.");
    }

    const data = await getMetricAudit({
      metric,
      accountId,
      asOfDate,
      mode: modeParam,
    });
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
