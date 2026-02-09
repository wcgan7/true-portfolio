import { describe, expect, it } from "vitest";

import { replayTransactions } from "@/src/lib/portfolio/replay";

describe("replayTransactions", () => {
  it("replays buy + sell with FIFO cost basis and realized pnl", () => {
    const output = replayTransactions([
      {
        id: "t1",
        accountId: "acc",
        instrumentId: "inst",
        type: "BUY",
        tradeDate: new Date("2026-01-01"),
        quantity: 10,
        price: 100,
        amount: 1000,
        feeAmount: 1,
      },
      {
        id: "t2",
        accountId: "acc",
        instrumentId: "inst",
        type: "SELL",
        tradeDate: new Date("2026-01-02"),
        quantity: 4,
        price: 120,
        amount: 480,
        feeAmount: 1,
      },
    ]);

    expect(output.cashByAccount.acc).toBeCloseTo(-522, 6);
    expect(output.positions).toHaveLength(1);
    expect(output.positions[0].quantity).toBeCloseTo(6, 6);
    expect(output.positions[0].costBasis).toBeCloseTo(600.6, 6);
    expect(output.positions[0].realizedPnl).toBeCloseTo(78.6, 6);
    expect(output.totalRealizedPnl).toBeCloseTo(78.6, 6);
  });

  it("includes dividends and fees in realized pnl and cash", () => {
    const output = replayTransactions([
      {
        id: "d1",
        accountId: "acc",
        instrumentId: null,
        type: "DIVIDEND",
        tradeDate: new Date("2026-01-03"),
        quantity: null,
        price: null,
        amount: 50,
        feeAmount: 0,
      },
      {
        id: "f1",
        accountId: "acc",
        instrumentId: null,
        type: "FEE",
        tradeDate: new Date("2026-01-04"),
        quantity: null,
        price: null,
        amount: 5,
        feeAmount: 0,
      },
    ]);

    expect(output.cashByAccount.acc).toBeCloseTo(45, 6);
    expect(output.totalRealizedPnl).toBeCloseTo(45, 6);
  });

  it("throws when sell quantity exceeds available lots", () => {
    expect(() =>
      replayTransactions([
        {
          id: "t1",
          accountId: "acc",
          instrumentId: "inst",
          type: "BUY",
          tradeDate: new Date("2026-01-01"),
          quantity: 1,
          price: 100,
          amount: 100,
          feeAmount: 0,
        },
        {
          id: "t2",
          accountId: "acc",
          instrumentId: "inst",
          type: "SELL",
          tradeDate: new Date("2026-01-02"),
          quantity: 2,
          price: 100,
          amount: 200,
          feeAmount: 0,
        },
      ]),
    ).toThrow("Insufficient lots");
  });
});
