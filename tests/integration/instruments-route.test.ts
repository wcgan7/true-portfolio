import { describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/instruments/route";

describe("/api/instruments route", () => {
  it("creates a valid stock instrument", async () => {
    const res = await POST(
      new Request("http://localhost/api/instruments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: "aapl",
          name: "Apple",
          kind: "STOCK",
          currency: "USD",
        }),
      }),
    );
    expect(res.status).toBe(201);
    const payload = (await res.json()) as { data: { symbol: string; kind: string } };
    expect(payload.data.symbol).toBe("AAPL");
    expect(payload.data.kind).toBe("STOCK");
  });

  it("rejects invalid symbol format", async () => {
    const res = await POST(
      new Request("http://localhost/api/instruments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: "BAD SYMBOL",
          name: "Bad",
          kind: "STOCK",
          currency: "USD",
        }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects duplicate symbol-kind pair", async () => {
    const body = {
      symbol: "SPY_DUP",
      name: "SPY",
      kind: "ETF",
      currency: "USD",
    };
    const first = await POST(
      new Request("http://localhost/api/instruments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(first.status).toBe(201);

    const second = await POST(
      new Request("http://localhost/api/instruments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    expect(second.status).toBe(400);
  });

  it("lists instruments in deterministic order", async () => {
    await POST(
      new Request("http://localhost/api/instruments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: "ZZZ_1",
          name: "Z",
          kind: "STOCK",
          currency: "USD",
        }),
      }),
    );
    await POST(
      new Request("http://localhost/api/instruments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol: "AAA_1",
          name: "A",
          kind: "STOCK",
          currency: "USD",
        }),
      }),
    );

    const res = await GET();
    expect(res.status).toBe(200);
    const payload = (await res.json()) as { data: Array<{ symbol: string; kind: string }> };
    const stocks = payload.data.filter((row) => row.kind === "STOCK");
    const symbols = stocks.map((row) => row.symbol);
    const sorted = [...symbols].sort((a, b) => a.localeCompare(b));
    expect(symbols).toEqual(sorted);
  });
});

