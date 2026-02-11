import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { DomainValidationError } from "@/src/lib/errors";
import { transactionsQuerySchema } from "@/src/lib/schemas/transactions-query";
import { createTransactionSchema } from "@/src/lib/schemas/transaction";
import { createTransaction, listTransactions } from "@/src/lib/services/transaction-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = transactionsQuerySchema.parse({
      accountId: url.searchParams.get("accountId") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });

    const transactions = await listTransactions({
      accountId: query.accountId,
      from: query.from,
      to: query.to,
    });
    return NextResponse.json({ data: transactions });
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
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
