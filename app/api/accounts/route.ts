import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { createAccountSchema } from "@/src/lib/schemas/account";
import { createAccount, listAccounts } from "@/src/lib/services/account-service";

export async function GET() {
  const accounts = await listAccounts();
  return NextResponse.json({ data: accounts });
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const input = createAccountSchema.parse(payload);
    const account = await createAccount(input);
    return NextResponse.json({ data: account }, { status: 201 });
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

