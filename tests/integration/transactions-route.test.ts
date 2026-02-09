import { describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/transactions/route";
import { prisma } from "@/src/lib/db";

async function seedAccountAndInstrument() {
  const account = await prisma.account.create({
    data: { name: "Primary", baseCurrency: "USD" },
  });

  const symbolSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const instrument = await prisma.instrument.create({
    data: {
      symbol: `AAPL_${symbolSuffix}`,
      name: "Apple Inc",
      kind: "STOCK",
      currency: "USD",
    },
  });

  return { account, instrument };
}

describe("/api/transactions route", () => {
  it("rejects oversell when position would go negative", async () => {
    const { account, instrument } = await seedAccountAndInstrument();

    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: account.id,
        instrumentId: instrument.id,
        type: "SELL",
        tradeDate: "2026-01-10",
        quantity: 1,
        price: 10,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const payload = (await res.json()) as { error: string };
    expect(payload.error).toContain("negative position");
  });

  it("rejects invalid trade payloads", async () => {
    const { account } = await seedAccountAndInstrument();
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: account.id,
        type: "BUY",
        tradeDate: "2026-01-10",
        quantity: -1,
        price: 10,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("creates buy transaction and derives amount when omitted", async () => {
    const { account, instrument } = await seedAccountAndInstrument();
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: account.id,
        instrumentId: instrument.id,
        type: "BUY",
        tradeDate: "2026-01-10",
        quantity: 2,
        price: 100.25,
        feeAmount: 1,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const payload = (await res.json()) as { data: { amount: string; type: string } };
    expect(payload.data.type).toBe("BUY");
    expect(Number(payload.data.amount)).toBeCloseTo(200.5, 6);
  });

  it("returns transactions sorted by replay order", async () => {
    const { account, instrument } = await seedAccountAndInstrument();

    await prisma.transaction.createMany({
      data: [
        {
          accountId: account.id,
          instrumentId: instrument.id,
          type: "BUY",
          tradeDate: new Date("2026-01-11T00:00:00.000Z"),
          quantity: 1,
          price: 10,
          amount: 10,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          instrumentId: instrument.id,
          type: "BUY",
          tradeDate: new Date("2026-01-09T00:00:00.000Z"),
          quantity: 1,
          price: 11,
          amount: 11,
          feeAmount: 0,
        },
      ],
    });

    const res = await GET(new Request(`http://localhost/api/transactions?accountId=${account.id}`));
    expect(res.status).toBe(200);

    const payload = (await res.json()) as { data: Array<{ tradeDate: string }> };
    expect(payload.data).toHaveLength(2);
    expect(new Date(payload.data[0].tradeDate).toISOString()).toBe("2026-01-09T00:00:00.000Z");
    expect(new Date(payload.data[1].tradeDate).toISOString()).toBe("2026-01-11T00:00:00.000Z");
  });

  it("applies accountId filter in GET /api/transactions", async () => {
    const first = await seedAccountAndInstrument();
    const second = await seedAccountAndInstrument();

    await prisma.transaction.create({
      data: {
        accountId: first.account.id,
        instrumentId: first.instrument.id,
        type: "BUY",
        tradeDate: new Date("2026-01-09"),
        quantity: 1,
        price: 10,
        amount: 10,
        feeAmount: 0,
      },
    });
    await prisma.transaction.create({
      data: {
        accountId: second.account.id,
        instrumentId: second.instrument.id,
        type: "BUY",
        tradeDate: new Date("2026-01-09"),
        quantity: 1,
        price: 10,
        amount: 10,
        feeAmount: 0,
      },
    });

    const res = await GET(
      new Request(`http://localhost/api/transactions?accountId=${first.account.id}`),
    );
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { data: Array<{ accountId: string }> };
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0].accountId).toBe(first.account.id);
  });

  it("returns 400 for non-existent account id", async () => {
    const { instrument } = await seedAccountAndInstrument();
    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: "non-existent-account-id",
        instrumentId: instrument.id,
        type: "BUY",
        tradeDate: "2026-01-10",
        quantity: 1,
        price: 10,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("rejects BUY against CASH instrument kind", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    const cashInstrument = await prisma.instrument.create({
      data: { symbol: "USD", name: "US Dollar", kind: "CASH", currency: "USD" },
    });

    const req = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: account.id,
        instrumentId: cashInstrument.id,
        type: "BUY",
        tradeDate: "2026-01-10",
        quantity: 1,
        price: 1,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const payload = (await res.json()) as { error: string };
    expect(payload.error).toContain("CASH");
  });

  it("rejects duplicate externalRef per account", async () => {
    const { account, instrument } = await seedAccountAndInstrument();
    const body = {
      accountId: account.id,
      instrumentId: instrument.id,
      type: "BUY",
      tradeDate: "2026-01-10",
      quantity: 1,
      price: 10,
      externalRef: "broker-123",
    };

    const first = await POST(
      new Request("http://localhost/api/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(first.status).toBe(201);

    const second = await POST(
      new Request("http://localhost/api/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(second.status).toBe(400);
    const payload = (await second.json()) as { error: string };
    expect(payload.error).toContain("Duplicate externalRef");
  });
});
