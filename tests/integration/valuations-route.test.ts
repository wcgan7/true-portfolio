import { describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/valuations/route";
import { prisma } from "@/src/lib/db";

describe("/api/valuations route", () => {
  it("recomputes portfolio and account rows idempotently", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    const instrument = await prisma.instrument.create({
      data: { symbol: "AAPL_VAL", name: "Apple Val", kind: "STOCK", currency: "USD" },
    });

    await prisma.transaction.createMany({
      data: [
        {
          accountId: account.id,
          type: "DEPOSIT",
          tradeDate: new Date("2026-01-10"),
          amount: 100,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          instrumentId: instrument.id,
          type: "BUY",
          tradeDate: new Date("2026-01-10"),
          quantity: 1,
          price: 100,
          amount: 100,
          feeAmount: 0,
        },
      ],
    });
    await prisma.pricePoint.createMany({
      data: [
        {
          instrumentId: instrument.id,
          date: new Date("2026-01-10"),
          close: 100,
          source: "manual",
        },
        {
          instrumentId: instrument.id,
          date: new Date("2026-01-11"),
          close: 110,
          source: "manual",
        },
      ],
    });

    const first = await POST(
      new Request("http://localhost/api/valuations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: "2026-01-10", to: "2026-01-11" }),
      }),
    );
    expect(first.status).toBe(200);
    const firstPayload = (await first.json()) as {
      data: { datesProcessed: number; rowsUpserted: number; portfolioRowsUpserted: number; accountRowsUpserted: number };
    };
    expect(firstPayload.data.datesProcessed).toBe(2);
    expect(firstPayload.data.portfolioRowsUpserted).toBe(2);
    expect(firstPayload.data.accountRowsUpserted).toBe(2);
    expect(firstPayload.data.rowsUpserted).toBe(4);

    const second = await POST(
      new Request("http://localhost/api/valuations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: "2026-01-10", to: "2026-01-11" }),
      }),
    );
    expect(second.status).toBe(200);

    const rows = await prisma.dailyValuation.findMany();
    expect(rows).toHaveLength(4);
  });

  it("recomputes only scoped account when accountId is provided", async () => {
    const accountA = await prisma.account.create({
      data: { name: "A", baseCurrency: "USD" },
    });
    const accountB = await prisma.account.create({
      data: { name: "B", baseCurrency: "USD" },
    });

    await prisma.transaction.createMany({
      data: [
        {
          accountId: accountA.id,
          type: "DEPOSIT",
          tradeDate: new Date("2026-01-10"),
          amount: 100,
          feeAmount: 0,
        },
        {
          accountId: accountB.id,
          type: "DEPOSIT",
          tradeDate: new Date("2026-01-10"),
          amount: 200,
          feeAmount: 0,
        },
      ],
    });

    const res = await POST(
      new Request("http://localhost/api/valuations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: accountA.id,
          from: "2026-01-10",
          to: "2026-01-10",
        }),
      }),
    );

    expect(res.status).toBe(200);
    const rows = await prisma.dailyValuation.findMany({ orderBy: { date: "asc" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].accountId).toBe(accountA.id);
    expect(Number(rows[0].totalValue)).toBeCloseTo(100, 6);
  });

  it("lists valuations with date and account filters", async () => {
    const accountA = await prisma.account.create({ data: { name: "A", baseCurrency: "USD" } });
    const accountB = await prisma.account.create({ data: { name: "B", baseCurrency: "USD" } });

    await prisma.dailyValuation.createMany({
      data: [
        {
          date: new Date("2026-01-10"),
          accountId: accountA.id,
          cashValue: 10,
          marketValue: 20,
          totalValue: 30,
          completenessFlag: true,
        },
        {
          date: new Date("2026-01-11"),
          accountId: accountA.id,
          cashValue: 11,
          marketValue: 21,
          totalValue: 32,
          completenessFlag: true,
        },
        {
          date: new Date("2026-01-10"),
          accountId: accountB.id,
          cashValue: 99,
          marketValue: 1,
          totalValue: 100,
          completenessFlag: false,
        },
      ],
    });

    const res = await GET(
      new Request(
        `http://localhost/api/valuations?accountId=${accountA.id}&from=2026-01-11&to=2026-01-11`,
      ),
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { data: Array<{ accountId: string; totalValue: string }> };
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].accountId).toBe(accountA.id);
    expect(Number(payload.data[0].totalValue)).toBeCloseTo(32, 6);
  });

  it("returns 400 for invalid ranges", async () => {
    const postRes = await POST(
      new Request("http://localhost/api/valuations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from: "2026-01-11", to: "2026-01-10" }),
      }),
    );
    expect(postRes.status).toBe(400);

    const getRes = await GET(new Request("http://localhost/api/valuations?from=bad-date"));
    expect(getRes.status).toBe(400);
  });

  it("marks completeness false when valuation uses missing prices", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    const instrument = await prisma.instrument.create({
      data: { symbol: "NO_PRICE_VAL", name: "No Price", kind: "STOCK", currency: "USD" },
    });
    await prisma.transaction.createMany({
      data: [
        {
          accountId: account.id,
          type: "DEPOSIT",
          tradeDate: new Date("2026-01-10"),
          amount: 100,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          instrumentId: instrument.id,
          type: "BUY",
          tradeDate: new Date("2026-01-10"),
          quantity: 1,
          price: 100,
          amount: 100,
          feeAmount: 0,
        },
      ],
    });

    const res = await POST(
      new Request("http://localhost/api/valuations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId: account.id, from: "2026-01-10", to: "2026-01-10" }),
      }),
    );
    expect(res.status).toBe(200);

    const row = await prisma.dailyValuation.findFirst({
      where: { accountId: account.id, date: new Date("2026-01-10") },
    });
    expect(row).not.toBeNull();
    expect(row!.completenessFlag).toBe(false);
  });

  it("returns 400 for unknown accountId in recompute request", async () => {
    const res = await POST(
      new Request("http://localhost/api/valuations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId: "missing-account", from: "2026-01-10", to: "2026-01-10" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
