"use client";

import { FormEvent, useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

type Account = {
  id: string;
  name: string;
};

type DailyValuation = {
  id: string;
  date: string;
  accountId: string | null;
  cashValue: string;
  marketValue: string;
  totalValue: string;
  completenessFlag: boolean;
};

type RecomputeResult = {
  from: string;
  to: string;
  datesProcessed: number;
  rowsUpserted: number;
  portfolioRowsUpserted: number;
  accountRowsUpserted: number;
};

export default function ValuationsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<DailyValuation[]>([]);
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RecomputeResult | null>(null);

  async function loadAccounts() {
    const res = await fetch("/api/accounts");
    const payload = (await res.json()) as { data?: Account[]; error?: string };
    if (!res.ok || !payload.data) {
      throw new Error(payload.error ?? "Failed to load accounts");
    }
    setAccounts(payload.data);
  }

  async function loadRows(next?: { accountId?: string; from?: string; to?: string }) {
    const params = new URLSearchParams();
    if (next?.accountId) params.set("accountId", next.accountId);
    if (next?.from) params.set("from", next.from);
    if (next?.to) params.set("to", next.to);
    const query = params.toString();
    const res = await fetch(`/api/valuations${query ? `?${query}` : ""}`);
    const payload = (await res.json()) as { data?: DailyValuation[]; error?: string };
    if (!res.ok || !payload.data) {
      throw new Error(payload.error ?? "Failed to load valuations");
    }
    setRows(payload.data);
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadAccounts(), loadRows()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load page");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onRecompute(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (from && to && from > to) {
      setError("from must be <= to");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/valuations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: accountId || undefined,
          from: from || undefined,
          to: to || undefined,
        }),
      });
      const payload = (await res.json()) as { data?: RecomputeResult; error?: string };
      if (!res.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to recompute valuations");
      }
      setLastResult(payload.data);
      await loadRows({ accountId: accountId || undefined, from: from || undefined, to: to || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to recompute valuations");
    } finally {
      setSubmitting(false);
    }
  }

  async function onApplyFilter() {
    setError(null);
    try {
      await loadRows({ accountId: accountId || undefined, from: from || undefined, to: to || undefined });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load valuations");
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Valuations</h1>
      <p>Materialize and review daily valuation rows.</p>

      <section>
        <h2>Recompute Daily Valuations</h2>
        <form onSubmit={onRecompute} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
          <label htmlFor="val-account">Account</label>
          <select
            id="val-account"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
            data-testid="valuation-account-select"
          >
            <option value="">All accounts + portfolio</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>

          <label htmlFor="val-from">From</label>
          <input
            id="val-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            data-testid="valuation-from-input"
          />

          <label htmlFor="val-to">To</label>
          <input
            id="val-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            data-testid="valuation-to-input"
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={submitting} data-testid="recompute-valuations-btn">
              {submitting ? "Recomputing..." : "Recompute"}
            </button>
            <button type="button" onClick={() => void onApplyFilter()} data-testid="load-valuations-btn">
              Load Rows
            </button>
          </div>
        </form>
      </section>

      {error ? (
        <p role="alert" style={{ color: "#b00020" }}>
          {error}
        </p>
      ) : null}

      {lastResult ? (
        <section>
          <h2>Last Recompute</h2>
          <p data-testid="valuation-last-result">
            {lastResult.from} to {lastResult.to} | dates={lastResult.datesProcessed} | rows={lastResult.rowsUpserted}
          </p>
        </section>
      ) : null}

      <section>
        <h2>Persisted Daily Valuations</h2>
        {loading ? <p>Loading...</p> : null}
        {!loading && rows.length === 0 ? <p>No rows found.</p> : null}
        {!loading && rows.length > 0 ? (
          <div>
            <h3>Valuation Series</h3>
            <div style={{ width: "100%", overflowX: "auto" }}>
              <LineChart
                width={Math.max(720, rows.length * 80)}
                height={280}
                data={rows.map((row) => ({
                  date: new Date(row.date).toISOString().slice(0, 10),
                  totalValue: Number(row.totalValue),
                }))}
                margin={{ top: 12, right: 16, bottom: 12, left: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis tickFormatter={(value: number) => `$${value.toFixed(0)}`} width={90} />
                <Tooltip
                  formatter={(value) => {
                    const totalValue = Number(value ?? 0);
                    return [`$${totalValue.toFixed(2)}`, "Total Value"];
                  }}
                />
                <Line type="monotone" dataKey="totalValue" stroke="#0f766e" strokeWidth={2} dot={false} />
              </LineChart>
            </div>
          </div>
        ) : null}
        {!loading && rows.length > 0 ? (
          <table data-testid="valuations-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Account</th>
                <th>Cash</th>
                <th>Market</th>
                <th>Total</th>
                <th>Complete</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{new Date(row.date).toISOString().slice(0, 10)}</td>
                  <td>{row.accountId ?? "PORTFOLIO"}</td>
                  <td>{Number(row.cashValue).toFixed(2)}</td>
                  <td>{Number(row.marketValue).toFixed(2)}</td>
                  <td>{Number(row.totalValue).toFixed(2)}</td>
                  <td>{row.completenessFlag ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </section>
    </main>
  );
}
