import { describe, expect, it } from "vitest";

import { prisma } from "@/src/lib/db";
import { getValuationSnapshotCore } from "@/src/lib/services/valuation-core";

describe("valuation-core fixture coverage", () => {
  it("uses last known close and emits stale fallback warning", async () => {
    const account = await prisma.account.create({
      data: { name: "Fixture Account", baseCurrency: "USD" },
    });
    const instrument = await prisma.instrument.create({
      data: { symbol: "STALE_FIX", name: "Stale Fixture", kind: "STOCK", currency: "USD" },
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
    await prisma.pricePoint.create({
      data: {
        instrumentId: instrument.id,
        date: new Date("2026-01-08"),
        close: 95,
        source: "manual",
      },
    });

    const snapshot = await getValuationSnapshotCore({
      accountId: account.id,
      asOfDate: new Date("2026-01-10"),
    });

    expect(snapshot.totals.marketValue).toBeCloseTo(95, 6);
    expect(snapshot.warnings.some((warning) => warning.code === "STALE_PRICE_FALLBACK")).toBe(true);
    expect(snapshot.warnings.some((warning) => warning.code === "MISSING_PRICE")).toBe(false);
  });

  it("emits missing price warning when no historical close exists", async () => {
    const account = await prisma.account.create({
      data: { name: "Fixture Account", baseCurrency: "USD" },
    });
    const instrument = await prisma.instrument.create({
      data: { symbol: "MISS_FIX", name: "Missing Fixture", kind: "STOCK", currency: "USD" },
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

    const snapshot = await getValuationSnapshotCore({
      accountId: account.id,
      asOfDate: new Date("2026-01-10"),
    });

    expect(snapshot.totals.marketValue).toBeCloseTo(0, 6);
    expect(snapshot.warnings.some((warning) => warning.code === "MISSING_PRICE")).toBe(true);
  });
});
