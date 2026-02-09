import { describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/accounts/route";

describe("/api/accounts route", () => {
  it("creates account with USD base currency", async () => {
    const req = new Request("http://localhost/api/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Main Account", baseCurrency: "USD" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);

    const payload = (await res.json()) as { data: { name: string; baseCurrency: string } };
    expect(payload.data.name).toBe("Main Account");
    expect(payload.data.baseCurrency).toBe("USD");
  });

  it("rejects unsupported currency", async () => {
    const req = new Request("http://localhost/api/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Bad Currency", baseCurrency: "EUR" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns created accounts in GET", async () => {
    const reqA = new Request("http://localhost/api/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "A", baseCurrency: "USD" }),
    });
    const reqB = new Request("http://localhost/api/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "B", baseCurrency: "USD" }),
    });

    await POST(reqA);
    await POST(reqB);

    const res = await GET();
    expect(res.status).toBe(200);

    const payload = (await res.json()) as { data: Array<{ name: string }> };
    expect(payload.data).toHaveLength(2);
    expect(payload.data.map((item) => item.name)).toEqual(["A", "B"]);
  });
});

