import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { getDefaultPortfolioEngines } from "@/src/lib/engines/default-engines";
import { DomainValidationError } from "@/src/lib/errors";
import { auditMetricQuerySchema } from "@/src/lib/schemas/audit-query";
import { getMetricAudit } from "@/src/lib/services/audit-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = auditMetricQuerySchema.parse({
      metric: url.searchParams.get("metric") ?? undefined,
      accountId: url.searchParams.get("accountId") ?? undefined,
      asOfDate: url.searchParams.get("asOfDate") ?? undefined,
      mode: url.searchParams.get("mode") ?? undefined,
      scopeDimension: url.searchParams.get("scopeDimension") ?? undefined,
      scopeSymbol: url.searchParams.get("scopeSymbol") ?? undefined,
    });

    const data = await getMetricAudit({
      metric: query.metric,
      accountId: query.accountId,
      asOfDate: query.asOfDate,
      mode: query.mode,
      scopeDimension: query.scopeDimension,
      scopeSymbol: query.scopeSymbol,
      engines: getDefaultPortfolioEngines(),
    });
    return NextResponse.json({ data });
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
