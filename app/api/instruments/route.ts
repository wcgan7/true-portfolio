import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { DomainValidationError } from "@/src/lib/errors";
import { createInstrumentSchema } from "@/src/lib/schemas/instrument";
import { createInstrument, listInstruments } from "@/src/lib/services/instrument-service";

export async function GET() {
  const instruments = await listInstruments();
  return NextResponse.json({ data: instruments });
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const input = createInstrumentSchema.parse(payload);
    const instrument = await createInstrument(input);
    return NextResponse.json({ data: instrument }, { status: 201 });
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

