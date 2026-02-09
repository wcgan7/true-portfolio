import { describe, expect, it } from "vitest";

import { PATCH } from "@/app/api/transactions/[id]/route";
import { POST } from "@/app/api/transactions/route";
import { prisma } from "@/src/lib/db";

async function seedAccountAndInstrument() {
  const account = await prisma.account.create({
    data: { name: "Primary", baseCurrency: "USD" },
  });

  const instrument = await prisma.instrument.create({
    data: {
      symbol: "AAPL",
      name: "Apple Inc.",
      kind: "STOCK",
      currency: "USD",
    },
  });

  return { account, instrument };
}

describe("/api/transactions/[id] route", () => {
  it("rejects patch with duplicate externalRef for same account", async () => {
    const { account, instrument } = await seedAccountAndInstrument();

    const firstRes = await POST(
      new Request("http://localhost/api/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          instrumentId: instrument.id,
          type: "BUY",
          tradeDate: "2026-01-10",
          quantity: 10,
          price: 100,
          externalRef: "same-ref",
        }),
      }),
    );
    const secondRes = await POST(
      new Request("http://localhost/api/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          instrumentId: instrument.id,
          type: "BUY",
          tradeDate: "2026-01-11",
          quantity: 10,
          price: 100,
          externalRef: "other-ref",
        }),
      }),
    );

    const first = (await firstRes.json()) as { data: { id: string } };
    const second = (await secondRes.json()) as { data: { id: string } };

    const patchReq = new Request(`http://localhost/api/transactions/${second.data.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: account.id,
        instrumentId: instrument.id,
        type: "BUY",
        tradeDate: "2026-01-11",
        quantity: 10,
        price: 100,
        externalRef: "same-ref",
      }),
    });

    const patchRes = await PATCH(patchReq, {
      params: Promise.resolve({ id: second.data.id }),
    });
    expect(first.data.id).toBeTruthy();
    expect(patchRes.status).toBe(400);
  });

  it("updates transaction when edit remains position-safe", async () => {
    const { account, instrument } = await seedAccountAndInstrument();

    const buyRes = await POST(
      new Request("http://localhost/api/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          instrumentId: instrument.id,
          type: "BUY",
          tradeDate: "2026-01-10",
          quantity: 10,
          price: 100,
        }),
      }),
    );
    expect(buyRes.status).toBe(201);
    const buyPayload = (await buyRes.json()) as { data: { id: string } };

    const patchReq = new Request(`http://localhost/api/transactions/${buyPayload.data.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: account.id,
        instrumentId: instrument.id,
        type: "BUY",
        tradeDate: "2026-01-10",
        quantity: 12,
        price: 100,
      }),
    });

    const patchRes = await PATCH(patchReq, {
      params: Promise.resolve({ id: buyPayload.data.id }),
    });

    expect(patchRes.status).toBe(200);
    const patchPayload = (await patchRes.json()) as { data: { quantity: string } };
    expect(Number(patchPayload.data.quantity)).toBe(12);
  });

  it("returns 400 for invalid patch payload", async () => {
    const { account, instrument } = await seedAccountAndInstrument();
    const buyRes = await POST(
      new Request("http://localhost/api/transactions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: account.id,
          instrumentId: instrument.id,
          type: "BUY",
          tradeDate: "2026-01-10",
          quantity: 10,
          price: 100,
        }),
      }),
    );
    const buyPayload = (await buyRes.json()) as { data: { id: string } };

    const patchReq = new Request(`http://localhost/api/transactions/${buyPayload.data.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: account.id,
        instrumentId: instrument.id,
        type: "BUY",
        tradeDate: "2026-01-10",
        quantity: 0,
        price: 100,
      }),
    });

    const patchRes = await PATCH(patchReq, {
      params: Promise.resolve({ id: buyPayload.data.id }),
    });
    expect(patchRes.status).toBe(400);
  });

  it("rejects backdated edit that would create negative position", async () => {
    const { account, instrument } = await seedAccountAndInstrument();

    const buyReq = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: account.id,
        instrumentId: instrument.id,
        type: "BUY",
        tradeDate: "2026-01-10",
        quantity: 10,
        price: 100,
      }),
    });
    const sellReq = new Request("http://localhost/api/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: account.id,
        instrumentId: instrument.id,
        type: "SELL",
        tradeDate: "2026-01-11",
        quantity: 8,
        price: 101,
      }),
    });

    await POST(buyReq);
    const sellRes = await POST(sellReq);
    expect(sellRes.status).toBe(201);
    const sellPayload = (await sellRes.json()) as { data: { id: string } };

    const patchReq = new Request(`http://localhost/api/transactions/${sellPayload.data.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId: account.id,
        instrumentId: instrument.id,
        type: "SELL",
        tradeDate: "2026-01-09",
        quantity: 8,
        price: 101,
      }),
    });

    const patchRes = await PATCH(patchReq, {
      params: Promise.resolve({ id: sellPayload.data.id }),
    });
    expect(patchRes.status).toBe(400);

    const patchPayload = (await patchRes.json()) as { error: string };
    expect(patchPayload.error).toContain("negative position");
  });
});
