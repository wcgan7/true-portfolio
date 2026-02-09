import { describe, expect, it } from "vitest";

import { createTransactionSchema } from "@/src/lib/schemas/transaction";

describe("createTransactionSchema", () => {
  it("accepts valid BUY payload", () => {
    const parsed = createTransactionSchema.parse({
      accountId: "acc_1",
      instrumentId: "instr_1",
      type: "BUY",
      tradeDate: "2026-01-10",
      quantity: 2,
      price: 100.5,
      feeAmount: 1.25,
    });

    expect(parsed.type).toBe("BUY");
    expect(parsed.quantity).toBe(2);
  });

  it("rejects BUY without instrument/quantity/price", () => {
    const result = createTransactionSchema.safeParse({
      accountId: "acc_1",
      type: "BUY",
      tradeDate: "2026-01-10",
    });

    expect(result.success).toBe(false);
  });

  it("rejects zero or negative numeric fields", () => {
    const result = createTransactionSchema.safeParse({
      accountId: "acc_1",
      instrumentId: "instr_1",
      type: "SELL",
      tradeDate: "2026-01-10",
      quantity: 0,
      price: -1,
      feeAmount: -2,
    });

    expect(result.success).toBe(false);
  });

  it("rejects cash event with instrument fields", () => {
    const result = createTransactionSchema.safeParse({
      accountId: "acc_1",
      instrumentId: "instr_1",
      type: "DEPOSIT",
      tradeDate: "2026-01-10",
      amount: 500,
      quantity: 1,
    });

    expect(result.success).toBe(false);
  });

  it("rejects settleDate before tradeDate", () => {
    const result = createTransactionSchema.safeParse({
      accountId: "acc_1",
      instrumentId: "instr_1",
      type: "BUY",
      tradeDate: "2026-01-10",
      settleDate: "2026-01-09",
      quantity: 1,
      price: 10,
    });

    expect(result.success).toBe(false);
  });
});

