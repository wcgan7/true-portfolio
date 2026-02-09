import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { ConcurrencyConflictError, DomainValidationError } from "@/src/lib/errors";
import { valuationRefreshSchema } from "@/src/lib/schemas/valuation-refresh";
import {
  getValuationRefreshStatus,
  runValuationRefresh,
} from "@/src/lib/services/valuation-refresh-service";

export async function GET() {
  try {
    const status = await getValuationRefreshStatus();
    return NextResponse.json({ data: status }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const input = valuationRefreshSchema.parse(payload);
    const result = await runValuationRefresh(input);
    return NextResponse.json({ data: result }, { status: 200 });
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
