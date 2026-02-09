import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/valuations/refresh/alerts/route";
import { prisma } from "@/src/lib/db";

describe("/api/valuations/refresh/alerts route", () => {
  it("returns default empty report with no alert when no jobs exist", async () => {
    const res = await GET(new Request("http://localhost/api/valuations/refresh/alerts"));
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      data: {
        lookbackHours: number;
        totals: { jobs: number; succeeded: number; failed: number };
        consecutiveFailureCount: number;
        alert: { shouldWarn: boolean; reasons: string[] };
      };
    };

    expect(payload.data.lookbackHours).toBe(24);
    expect(payload.data.totals.jobs).toBe(0);
    expect(payload.data.totals.succeeded).toBe(0);
    expect(payload.data.totals.failed).toBe(0);
    expect(payload.data.consecutiveFailureCount).toBe(0);
    expect(payload.data.alert.shouldWarn).toBe(false);
    expect(payload.data.alert.reasons).toHaveLength(0);
  });

  it("returns alert signals for repeated failures and no lookback success", async () => {
    const now = Date.now();
    const h = 60 * 60 * 1000;

    await Promise.all([
      prisma.refreshJob.create({
        data: {
          status: "FAILED",
          trigger: "SCHEDULED",
          startedAt: new Date(now - h),
          finishedAt: new Date(now - h + 30_000),
          errorMessage: "f1",
        },
      }),
      prisma.refreshJob.create({
        data: {
          status: "FAILED",
          trigger: "SCHEDULED",
          startedAt: new Date(now - 2 * h),
          finishedAt: new Date(now - 2 * h + 30_000),
          errorMessage: "f2",
        },
      }),
      prisma.refreshJob.create({
        data: {
          status: "FAILED",
          trigger: "SCHEDULED",
          startedAt: new Date(now - 3 * h),
          finishedAt: new Date(now - 3 * h + 30_000),
          errorMessage: "f3",
        },
      }),
      prisma.refreshJob.create({
        data: {
          status: "SUCCEEDED",
          trigger: "MANUAL",
          startedAt: new Date(now - 30 * h),
          finishedAt: new Date(now - 30 * h + 30_000),
        },
      }),
    ]);

    const res = await GET(
      new Request("http://localhost/api/valuations/refresh/alerts?lookbackHours=24"),
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      data: {
        totals: { jobs: number; succeeded: number; failed: number };
        latest: { lastSuccessAt: string | null; lastFailureAt: string | null };
        consecutiveFailureCount: number;
        alert: { shouldWarn: boolean; reasons: string[] };
      };
    };

    expect(payload.data.totals.jobs).toBe(3);
    expect(payload.data.totals.succeeded).toBe(0);
    expect(payload.data.totals.failed).toBe(3);
    expect(payload.data.latest.lastSuccessAt).not.toBeNull();
    expect(payload.data.latest.lastFailureAt).not.toBeNull();
    expect(payload.data.consecutiveFailureCount).toBeGreaterThanOrEqual(3);
    expect(payload.data.alert.shouldWarn).toBe(true);
    expect(payload.data.alert.reasons.length).toBeGreaterThanOrEqual(2);
  });

  it("returns 400 for invalid lookbackHours query", async () => {
    const res = await GET(
      new Request("http://localhost/api/valuations/refresh/alerts?lookbackHours=abc"),
    );
    expect(res.status).toBe(400);
  });
});
