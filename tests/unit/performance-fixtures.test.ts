import { describe, expect, it } from "vitest";

import { prisma } from "@/src/lib/db";
import { getPerformanceMetrics } from "@/src/lib/services/performance-service";

describe("performance fixture coverage", () => {
  it("matches MWR reference fixture for one-year 10% growth", async () => {
    const account = await prisma.account.create({
      data: { name: "Fixture Account", baseCurrency: "USD" },
    });
    const instrument = await prisma.instrument.create({
      data: { symbol: "MWR_FIX", name: "MWR Fixture", kind: "STOCK", currency: "USD" },
    });

    await prisma.transaction.createMany({
      data: [
        {
          accountId: account.id,
          type: "DEPOSIT",
          tradeDate: new Date("2025-12-31"),
          amount: 100,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          instrumentId: instrument.id,
          type: "BUY",
          tradeDate: new Date("2025-12-31"),
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
          date: new Date("2025-12-31"),
          close: 100,
          source: "manual",
        },
        {
          instrumentId: instrument.id,
          date: new Date("2027-01-01"),
          close: 110,
          source: "manual",
        },
      ],
    });

    const metrics = await getPerformanceMetrics({
      accountId: account.id,
      period: "custom",
      from: new Date("2026-01-01"),
      to: new Date("2027-01-01"),
      asOfDate: new Date("2027-01-01"),
    });

    expect(metrics.mwr).not.toBeNull();
    expect(metrics.mwr!).toBeCloseTo(0.1, 6);
  });

  it("matches TWR daily chaining fixture with external flow neutralization", async () => {
    const account = await prisma.account.create({
      data: { name: "Fixture Account", baseCurrency: "USD" },
    });
    const instrument = await prisma.instrument.create({
      data: { symbol: "TWR_FIX", name: "TWR Fixture", kind: "STOCK", currency: "USD" },
    });

    await prisma.transaction.createMany({
      data: [
        {
          accountId: account.id,
          type: "DEPOSIT",
          tradeDate: new Date("2025-12-31"),
          amount: 100,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          instrumentId: instrument.id,
          type: "BUY",
          tradeDate: new Date("2025-12-31"),
          quantity: 1,
          price: 100,
          amount: 100,
          feeAmount: 0,
        },
        {
          accountId: account.id,
          type: "DEPOSIT",
          tradeDate: new Date("2026-01-01"),
          amount: 50,
          feeAmount: 0,
        },
      ],
    });
    await prisma.pricePoint.createMany({
      data: [
        {
          instrumentId: instrument.id,
          date: new Date("2025-12-31"),
          close: 100,
          source: "manual",
        },
        {
          instrumentId: instrument.id,
          date: new Date("2026-01-02"),
          close: 115,
          source: "manual",
        },
      ],
    });

    const metrics = await getPerformanceMetrics({
      accountId: account.id,
      period: "custom",
      from: new Date("2026-01-01"),
      to: new Date("2026-01-02"),
      asOfDate: new Date("2026-01-02"),
    });

    expect(metrics.twr).not.toBeNull();
    expect(metrics.twr!).toBeCloseTo(0.1, 6);
  });
});
