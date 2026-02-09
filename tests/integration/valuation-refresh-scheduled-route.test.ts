import { describe, expect, it } from "vitest";

import { GET as GETJobs } from "@/app/api/valuations/refresh/jobs/route";
import { POST as POSTScheduled } from "@/app/api/valuations/refresh/scheduled/route";
import { prisma } from "@/src/lib/db";

describe("/api/valuations/refresh/scheduled + jobs routes", () => {
  it("returns 500 when cron secret is not configured", async () => {
    delete process.env.VALUATION_REFRESH_CRON_SECRET;

    const res = await POSTScheduled(
      new Request("http://localhost/api/valuations/refresh/scheduled", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(500);
  });

  it("returns 401 when scheduled secret header is missing/invalid", async () => {
    process.env.VALUATION_REFRESH_CRON_SECRET = "test-secret";

    const res = await POSTScheduled(
      new Request("http://localhost/api/valuations/refresh/scheduled", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbols: ["NO_SUCH_SYMBOL"], from: "2026-01-10", to: "2026-01-10" }),
      }),
    );

    expect(res.status).toBe(401);
  });

  it("returns 400 when scheduled payload is invalid", async () => {
    process.env.VALUATION_REFRESH_CRON_SECRET = "test-secret";

    const res = await POSTScheduled(
      new Request("http://localhost/api/valuations/refresh/scheduled", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cron-secret": "test-secret",
        },
        body: JSON.stringify({ from: "2026-01-11", to: "2026-01-10" }),
      }),
    );

    expect(res.status).toBe(400);
  });

  it("runs scheduled refresh with valid secret and exposes job in jobs list", async () => {
    process.env.VALUATION_REFRESH_CRON_SECRET = "test-secret";

    const runRes = await POSTScheduled(
      new Request("http://localhost/api/valuations/refresh/scheduled", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-cron-secret": "test-secret",
        },
        body: JSON.stringify({ symbols: ["NO_SUCH_SYMBOL"], from: "2026-01-10", to: "2026-01-10" }),
      }),
    );

    expect(runRes.status).toBe(200);
    const runPayload = (await runRes.json()) as {
      data: { jobId: string; price: { missingSymbols: string[] } };
    };
    expect(runPayload.data.jobId).toBeTruthy();
    expect(runPayload.data.price.missingSymbols).toContain("NO_SUCH_SYMBOL");

    const jobsRes = await GETJobs(new Request("http://localhost/api/valuations/refresh/jobs?limit=5"));
    expect(jobsRes.status).toBe(200);
    const jobsPayload = (await jobsRes.json()) as {
      data: Array<{ id: string; trigger: string; status: string }>;
    };
    expect(jobsPayload.data.some((job) => job.id === runPayload.data.jobId)).toBe(true);
    expect(jobsPayload.data.some((job) => job.trigger === "SCHEDULED")).toBe(true);
  });

  it("returns bounded jobs list for invalid or extreme limit query params", async () => {
    await Promise.all(
      Array.from({ length: 3 }).map((_, idx) =>
        prisma.refreshJob.create({
          data: {
            status: "SUCCEEDED",
            trigger: "MANUAL",
            inputJson: { idx },
          },
        }),
      ),
    );

    const invalidLimitRes = await GETJobs(
      new Request("http://localhost/api/valuations/refresh/jobs?limit=not-a-number"),
    );
    expect(invalidLimitRes.status).toBe(400);

    const zeroLimitRes = await GETJobs(new Request("http://localhost/api/valuations/refresh/jobs?limit=0"));
    expect(zeroLimitRes.status).toBe(200);
    const zeroPayload = (await zeroLimitRes.json()) as { data: Array<{ id: string }> };
    expect(zeroPayload.data.length).toBe(1);
  });

  it("supports jobs filtering and pagination metadata", async () => {
    const jan1 = new Date("2026-01-01T00:00:00.000Z");
    const jan2 = new Date("2026-01-02T00:00:00.000Z");
    const jan3 = new Date("2026-01-03T00:00:00.000Z");

    const [job1, job2] = await Promise.all([
      prisma.refreshJob.create({
        data: { status: "SUCCEEDED", trigger: "MANUAL", startedAt: jan1, finishedAt: jan1 },
      }),
      prisma.refreshJob.create({
        data: { status: "FAILED", trigger: "SCHEDULED", startedAt: jan2, finishedAt: jan2 },
      }),
      prisma.refreshJob.create({
        data: { status: "SKIPPED_CONFLICT", trigger: "MANUAL", startedAt: jan3, finishedAt: jan3 },
      }),
    ]);

    const failedRes = await GETJobs(
      new Request("http://localhost/api/valuations/refresh/jobs?status=FAILED"),
    );
    expect(failedRes.status).toBe(200);
    const failedPayload = (await failedRes.json()) as {
      data: Array<{ id: string; status: string }>;
      meta: { total: number; hasMore: boolean };
    };
    expect(failedPayload.data).toHaveLength(1);
    expect(failedPayload.data[0]?.id).toBe(job2.id);
    expect(failedPayload.meta.total).toBe(1);
    expect(failedPayload.meta.hasMore).toBe(false);

    const manualPagedRes = await GETJobs(
      new Request("http://localhost/api/valuations/refresh/jobs?trigger=MANUAL&limit=1&offset=1"),
    );
    expect(manualPagedRes.status).toBe(200);
    const manualPagedPayload = (await manualPagedRes.json()) as {
      data: Array<{ id: string }>;
      meta: { total: number; hasMore: boolean; limit: number; offset: number };
    };
    expect(manualPagedPayload.meta.total).toBe(2);
    expect(manualPagedPayload.meta.limit).toBe(1);
    expect(manualPagedPayload.meta.offset).toBe(1);
    expect(manualPagedPayload.meta.hasMore).toBe(false);
    expect(manualPagedPayload.data).toHaveLength(1);
    expect(manualPagedPayload.data[0]?.id).toBe(job1.id);

    const invalidStatusRes = await GETJobs(
      new Request("http://localhost/api/valuations/refresh/jobs?status=bad_value"),
    );
    expect(invalidStatusRes.status).toBe(400);
  });
});
