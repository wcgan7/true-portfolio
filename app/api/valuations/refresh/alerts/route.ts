import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { DomainValidationError } from "@/src/lib/errors";
import { refreshAlertsQuerySchema } from "@/src/lib/schemas/refresh-alerts-query";
import { getRefreshAlertReport } from "@/src/lib/services/valuation-refresh-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = refreshAlertsQuerySchema.parse({
      lookbackHours: url.searchParams.get("lookbackHours") ?? undefined,
    });

    const data = await getRefreshAlertReport(query.lookbackHours);
    return NextResponse.json({ data }, { status: 200 });
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
