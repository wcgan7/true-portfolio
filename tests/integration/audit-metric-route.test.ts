import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/audit/metric/route";
import { prisma } from "@/src/lib/db";

describe("/api/audit/metric route", () => {
  it("returns 400 when metric is missing", async () => {
    const res = await GET(new Request("http://localhost/api/audit/metric"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported metric", async () => {
    const res = await GET(new Request("http://localhost/api/audit/metric?metric=sharpe"));
    expect(res.status).toBe(400);
  });

  it("returns metric value with holdings, transactions, and warnings contributors", async () => {
    const account = await prisma.account.create({
      data: { name: "Primary", baseCurrency: "USD" },
    });
    const instrument = await prisma.instrument.create({
      data: { symbol: "AAPL_AUD", name: "AAPL AUD", kind: "STOCK", currency: "USD" },
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

    const res = await GET(
      new Request("http://localhost/api/audit/metric?metric=totalValue&asOfDate=2026-01-10"),
    );
    expect(res.status).toBe(200);

    const payload = (await res.json()) as {
      data: {
        metric: string;
        value: number | null;
        mode: string;
        contributors: {
          holdings: Array<{ symbol: string }>;
          transactions: Array<{ type: string; signedCashDelta: number }>;
          warnings: Array<{ code: string }>;
        };
      };
    };

    expect(payload.data.metric).toBe("totalValue");
    expect(payload.data.mode).toBe("raw");
    expect(payload.data.value).toBeCloseTo(0, 6);
    expect(payload.data.contributors.holdings.some((holding) => holding.symbol === "AAPL_AUD")).toBe(true);
    expect(payload.data.contributors.transactions).toHaveLength(2);
    expect(payload.data.contributors.transactions.some((tx) => tx.type === "DEPOSIT")).toBe(true);
    expect(payload.data.contributors.transactions.some((tx) => tx.type === "BUY")).toBe(true);
    expect(payload.data.contributors.warnings.some((warning) => warning.code === "MISSING_PRICE")).toBe(
      true,
    );
  });

  it("scopes audit contributors by account", async () => {
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
          amount: 50,
          feeAmount: 0,
        },
        {
          accountId: accountB.id,
          type: "DEPOSIT",
          tradeDate: new Date("2026-01-10"),
          amount: 70,
          feeAmount: 0,
        },
      ],
    });

    const res = await GET(
      new Request(
        `http://localhost/api/audit/metric?metric=cashValue&asOfDate=2026-01-10&accountId=${accountA.id}`,
      ),
    );
    expect(res.status).toBe(200);

    const payload = (await res.json()) as {
      data: {
        accountId: string | null;
        value: number | null;
        contributors: {
          transactions: Array<{ accountId: string }>;
        };
      };
    };

    expect(payload.data.accountId).toBe(accountA.id);
    expect(payload.data.value).toBeCloseTo(50, 6);
    expect(payload.data.contributors.transactions).toHaveLength(1);
    expect(payload.data.contributors.transactions[0].accountId).toBe(accountA.id);
  });
});
