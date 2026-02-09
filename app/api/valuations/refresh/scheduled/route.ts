import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ConcurrencyConflictError, DomainValidationError } from "@/src/lib/errors";
import { valuationRefreshSchema } from "@/src/lib/schemas/valuation-refresh";
import { runValuationRefreshJob } from "@/src/lib/services/valuation-refresh-service";

export async function POST(req: Request) {
  try {
    const secret = process.env.VALUATION_REFRESH_CRON_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Cron secret is not configured" }, { status: 500 });
    }
    const provided = req.headers.get("x-cron-secret");
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const input = valuationRefreshSchema.parse(payload);
    const run = await runValuationRefreshJob({
      input,
      trigger: "SCHEDULED",
    });
    return NextResponse.json({ data: { jobId: run.jobId, ...run.result } }, { status: 200 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.flatten() },
        { status: 400 },
      );
    }
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ConcurrencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
