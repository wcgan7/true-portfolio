import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/etf-constituents/ingest/route";
import { prisma } from "@/src/lib/db";

describe("/api/etf-constituents/ingest route", () => {
  it("ingests curated ETF constituent rows and replaces existing rows for same asOfDate", async () => {
    await prisma.instrument.createMany({
      data: [
        { symbol: "SPY", name: "SPY", kind: "ETF", currency: "USD" },
        { symbol: "QQQ", name: "QQQ", kind: "ETF", currency: "USD" },
      ],
    });

    const firstReq = new Request("http://localhost/api/etf-constituents/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        asOfDate: "2026-01-31",
        source: "curated_file",
        rows: [
          { etfSymbol: "SPY", constituentSymbol: "AAPL", weight: 0.08 },
          { etfSymbol: "SPY", constituentSymbol: "MSFT", weight: 0.07 },
          { etfSymbol: "QQQ", constituentSymbol: "NVDA", weight: 0.09 },
        ],
      }),
    });
    const firstRes = await POST(firstReq);
    expect(firstRes.status).toBe(200);

    const secondReq = new Request("http://localhost/api/etf-constituents/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        asOfDate: "2026-01-31",
        source: "curated_file",
        replaceExistingAsOfDate: true,
        rows: [
          { etfSymbol: "SPY", constituentSymbol: "AAPL", weight: 0.1 },
          { etfSymbol: "QQQ", constituentSymbol: "MSFT", weight: 0.12 },
        ],
      }),
    });
    const secondRes = await POST(secondReq);
    expect(secondRes.status).toBe(200);
    const payload = (await secondRes.json()) as {
      data: { etfsProcessed: string[]; rowsInserted: number };
    };
    expect(payload.data.rowsInserted).toBe(2);
    expect(payload.data.etfsProcessed.sort()).toEqual(["QQQ", "SPY"]);

    const rows = await prisma.etfConstituent.findMany({
      where: { asOfDate: new Date("2026-01-31T00:00:00.000Z") },
      orderBy: [{ etfInstrumentId: "asc" }, { constituentSymbol: "asc" }],
    });
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.constituentSymbol === "AAPL" && Number(row.weight) === 0.1)).toBe(true);
    expect(rows.some((row) => row.constituentSymbol === "MSFT" && Number(row.weight) === 0.12)).toBe(true);
  });

  it("returns 400 when an ETF symbol is unknown", async () => {
    const req = new Request("http://localhost/api/etf-constituents/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        asOfDate: "2026-01-31",
        rows: [{ etfSymbol: "UNKNOWN_ETF", constituentSymbol: "AAPL", weight: 0.1 }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid payload", async () => {
    const req = new Request("http://localhost/api/etf-constituents/ingest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        asOfDate: "2026-01-31",
        rows: [{ etfSymbol: "SPY", constituentSymbol: "AAPL", weight: 0 }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
