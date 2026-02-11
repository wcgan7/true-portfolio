import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { DomainValidationError } from "@/src/lib/errors";
import { refreshJobsQuerySchema } from "@/src/lib/schemas/refresh-jobs-query";
import {
  countRefreshJobs,
  listRefreshJobs,
  type RefreshJobSummary,
} from "@/src/lib/services/valuation-refresh-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const query = refreshJobsQuerySchema.parse({
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      trigger: url.searchParams.get("trigger") ?? undefined,
    });
    const limit = query.limit;
    const offset = query.offset;
    const status = query.status as RefreshJobSummary["status"] | undefined;
    const trigger = query.trigger as RefreshJobSummary["trigger"] | undefined;

    const data = await listRefreshJobs({ limit, offset, status, trigger });
    const total = await countRefreshJobs({ status, trigger });
    const normalizedLimit = Math.max(1, Math.min(limit, 100));
    const normalizedOffset = Math.max(0, offset);

    return NextResponse.json(
      {
        data,
        meta: {
          limit: normalizedLimit,
          offset: normalizedOffset,
          total,
          hasMore: normalizedOffset + data.length < total,
        },
      },
      { status: 200 },
    );
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
