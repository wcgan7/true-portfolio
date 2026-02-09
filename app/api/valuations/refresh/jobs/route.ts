import { NextResponse } from "next/server";

import { DomainValidationError } from "@/src/lib/errors";
import {
  countRefreshJobs,
  listRefreshJobs,
  type RefreshJobSummary,
} from "@/src/lib/services/valuation-refresh-service";

const VALID_STATUSES: RefreshJobSummary["status"][] = [
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "SKIPPED_CONFLICT",
];
const VALID_TRIGGERS: RefreshJobSummary["trigger"][] = ["MANUAL", "SCHEDULED"];

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");
    const statusParam = url.searchParams.get("status");
    const triggerParam = url.searchParams.get("trigger");

    const limit = limitParam ? Number(limitParam) : 20;
    const offset = offsetParam ? Number(offsetParam) : 0;
    if (!Number.isFinite(limit)) {
      throw new DomainValidationError("Invalid limit query param.");
    }
    if (!Number.isFinite(offset)) {
      throw new DomainValidationError("Invalid offset query param.");
    }

    const status = statusParam?.toUpperCase() as RefreshJobSummary["status"] | undefined;
    const trigger = triggerParam?.toUpperCase() as RefreshJobSummary["trigger"] | undefined;
    if (status && !VALID_STATUSES.includes(status)) {
      throw new DomainValidationError("Invalid status query param.");
    }
    if (trigger && !VALID_TRIGGERS.includes(trigger)) {
      throw new DomainValidationError("Invalid trigger query param.");
    }

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
    if (error instanceof DomainValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
