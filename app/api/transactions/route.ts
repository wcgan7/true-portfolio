import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createTransactionSchema } from "@/src/lib/schemas/transaction";
import { createTransaction, listTransactions } from "@/src/lib/services/transaction-service";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId") ?? undefined;

  const transactions = await listTransactions(accountId);
  return NextResponse.json({ data: transactions });
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const input = createTransactionSchema.parse(payload);
    const transaction = await createTransaction(input);
    return NextResponse.json({ data: transaction }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid request body", details: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

