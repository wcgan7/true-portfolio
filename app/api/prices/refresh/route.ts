import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { DomainValidationError } from "@/src/lib/errors";
import { refreshPricesSchema } from "@/src/lib/schemas/price-refresh";
import { refreshPrices } from "@/src/lib/services/pricing-service";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const input = refreshPricesSchema.parse(payload);
    const result = await refreshPrices(input);
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

