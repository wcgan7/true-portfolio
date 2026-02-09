import { describe, expect, it } from "vitest";

import { cashDeltaForTransaction } from "@/src/lib/portfolio/ledger";

describe("cashDeltaForTransaction", () => {
  it("computes buy cash delta with fees", () => {
    const delta = cashDeltaForTransaction({
      type: "BUY",
      quantity: 10,
      price: 12.5,
      feeAmount: 1,
    });

    expect(delta).toBe(-126);
  });

  it("computes sell cash delta with fees", () => {
    const delta = cashDeltaForTransaction({
      type: "SELL",
      quantity: 10,
      price: 12.5,
      feeAmount: 1,
    });

    expect(delta).toBe(124);
  });

  it("computes dividend and deposit as positive cash", () => {
    expect(cashDeltaForTransaction({ type: "DIVIDEND", amount: 50 })).toBe(50);
    expect(cashDeltaForTransaction({ type: "DEPOSIT", amount: 1000 })).toBe(1000);
  });

  it("computes fee and withdrawal as negative cash", () => {
    expect(cashDeltaForTransaction({ type: "FEE", amount: 50 })).toBe(-50);
    expect(cashDeltaForTransaction({ type: "WITHDRAWAL", amount: 1000 })).toBe(-1000);
  });

  it("throws if required fields are missing", () => {
    expect(() => cashDeltaForTransaction({ type: "BUY" })).toThrow(
      "BUY requires quantity and price",
    );
    expect(() => cashDeltaForTransaction({ type: "DIVIDEND" })).toThrow(
      "DIVIDEND requires amount",
    );
  });
});

