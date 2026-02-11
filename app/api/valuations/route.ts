import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { DomainValidationError } from "@/src/lib/errors";
import { recomputeValuationsSchema } from "@/src/lib/schemas/valuation";
import { valuationsQuerySchema } from "@/src/lib/schemas/valuations-query";
import {
  listDailyValuations,
  recomputeDailyValuations,
} from "@/src/lib/services/valuation-materialization-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = valuationsQuerySchema.parse({
      accountId: url.searchParams.get("accountId") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    const data = await listDailyValuations({
      accountId: query.accountId,
      from: query.from,
      to: query.to,
    });
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
