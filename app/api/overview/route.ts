import { NextResponse } from "next/server";

import { DomainValidationError } from "@/src/lib/errors";
import { getOverviewSnapshot } from "@/src/lib/services/overview-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get("accountId") ?? undefined;
    const asOfDateParam = url.searchParams.get("asOfDate");
    const asOfDate = asOfDateParam ? new Date(asOfDateParam) : undefined;

    if (asOfDateParam && Number.isNaN(asOfDate?.getTime())) {
      throw new DomainValidationError("Invalid asOfDate. Expected ISO date.");
    }

    const snapshot = await getOverviewSnapshot({ accountId, asOfDate });
    return NextResponse.json({ data: snapshot });
  } catch (error) {
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

