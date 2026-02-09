import { NextResponse } from "next/server";

import { DomainValidationError } from "@/src/lib/errors";
import { getRefreshAlertReport } from "@/src/lib/services/valuation-refresh-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const lookbackParam = url.searchParams.get("lookbackHours");
    const lookbackHours = lookbackParam ? Number(lookbackParam) : 24;
    if (!Number.isFinite(lookbackHours)) {
      throw new DomainValidationError("Invalid lookbackHours query param.");
    }

    const data = await getRefreshAlertReport(lookbackHours);
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
