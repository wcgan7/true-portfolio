import { describe, expect, it } from "vitest";

import { sortTransactionsForReplay } from "@/src/lib/portfolio/ordering";

describe("sortTransactionsForReplay", () => {
  it("orders by tradeDate, then createdAt, then id", () => {
    const txs = [
      {
        id: "b",
        tradeDate: new Date("2026-01-10T00:00:00.000Z"),
        createdAt: new Date("2026-01-09T10:00:00.000Z"),
      },
      {
        id: "a",
        tradeDate: new Date("2026-01-10T00:00:00.000Z"),
        createdAt: new Date("2026-01-09T10:00:00.000Z"),
      },
      {
        id: "c",
        tradeDate: new Date("2026-01-09T00:00:00.000Z"),
        createdAt: new Date("2026-01-10T10:00:00.000Z"),
      },
    ];

    const sorted = sortTransactionsForReplay(txs);
    expect(sorted.map((tx) => tx.id)).toEqual(["c", "a", "b"]);
  });
});

