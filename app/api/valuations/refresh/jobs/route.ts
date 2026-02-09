import { NextResponse } from "next/server";

import { listRefreshJobs } from "@/src/lib/services/valuation-refresh-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : 20;
    const data = await listRefreshJobs(Number.isFinite(limit) ? limit : 20);
    return NextResponse.json({ data }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
