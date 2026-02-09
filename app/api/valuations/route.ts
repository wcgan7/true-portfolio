import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { DomainValidationError } from "@/src/lib/errors";
import { recomputeValuationsSchema } from "@/src/lib/schemas/valuation";
import {
  listDailyValuations,
  recomputeDailyValuations,
} from "@/src/lib/services/valuation-materialization-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const accountId = url.searchParams.get("accountId") ?? undefined;
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;

    if (fromParam && Number.isNaN(from?.getTime())) {
      throw new DomainValidationError("Invalid from. Expected ISO date.");
    }
    if (toParam && Number.isNaN(to?.getTime())) {
      throw new DomainValidationError("Invalid to. Expected ISO date.");
    }

    const data = await listDailyValuations({ accountId, from, to });
    return NextResponse.json({ data }, { status: 200 });
  } catch (error) {
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const input = recomputeValuationsSchema.parse(payload);
    const result = await recomputeDailyValuations(input);
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
