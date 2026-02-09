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
    expect(invalidLimitRes.status).toBe(200);
    const invalidPayload = (await invalidLimitRes.json()) as { data: Array<{ id: string }> };
    expect(invalidPayload.data.length).toBeGreaterThanOrEqual(3);

    const zeroLimitRes = await GETJobs(new Request("http://localhost/api/valuations/refresh/jobs?limit=0"));
    expect(zeroLimitRes.status).toBe(200);
    const zeroPayload = (await zeroLimitRes.json()) as { data: Array<{ id: string }> };
    expect(zeroPayload.data.length).toBe(1);
  });
});
