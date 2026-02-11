"use client";

import { useEffect, useState } from "react";

type AuditMetric =
  | "totalValue"
  | "marketValue"
  | "cashValue"
  | "realizedPnl"
  | "unrealizedPnl"
  | "mwr"
  | "twr";

type AuditScopeDimension = "holding" | "country" | "sector" | "industry" | "currency";

type MetricAuditPayload = {
  metric: AuditMetric;
  asOfDate: string;
  accountId: string | null;
  mode: "raw" | "lookthrough";
  scope: { dimension: AuditScopeDimension; symbol: string } | null;
  value: number | null;
  contributors: {
    holdings: Array<{
      accountId: string;
      instrumentId: string | null;
      symbol: string;
      kind: string;
      marketValue: number;
      portfolioWeightPct: number;
    }>;
    transactions: Array<{
      id: string;
      accountId: string;
      instrumentId: string | null;
      type: string;
      tradeDate: string;
      amount: number;
      feeAmount: number;
      signedCashDelta: number;
    }>;
    warnings: Array<{
      code: string;
      severity: string;
      accountId: string | null;
      instrumentId: string | null;
      date: string;
      resolvedAt: string | null;
      message: string | null;
      symbol: string | null;
    }>;
  };
};

const METRICS: AuditMetric[] = [
  "totalValue",
  "marketValue",
  "cashValue",
  "realizedPnl",
  "unrealizedPnl",
  "mwr",
  "twr",
];

export function MetricAuditDrawer(props: {
  asOfDate: string;
  mode: "raw" | "lookthrough";
  accountId?: string;
  initialMetric: AuditMetric | null;
  initialScopeDimension?: AuditScopeDimension;
  initialScopeSymbol?: string;
}) {
  const [isOpen, setIsOpen] = useState(Boolean(props.initialMetric));
  const [selectedMetric, setSelectedMetric] = useState<AuditMetric>(
    props.initialMetric ?? "totalValue",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audit, setAudit] = useState<MetricAuditPayload | null>(null);

  async function load(metric: AuditMetric) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        metric,
        asOfDate: props.asOfDate,
        mode: props.mode,
      });
      if (props.accountId) {
        params.set("accountId", props.accountId);
      }
      if (props.initialScopeDimension && props.initialScopeSymbol) {
        params.set("scopeDimension", props.initialScopeDimension);
        params.set("scopeSymbol", props.initialScopeSymbol);
      }
      const res = await fetch(`/api/audit/metric?${params.toString()}`);
      const payload = (await res.json()) as { data?: MetricAuditPayload; error?: string };
      if (!res.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to load metric audit");
      }
      setAudit(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metric audit");
    } finally {
      setLoading(false);
    }
  }

  function openWithMetric(metric: AuditMetric) {
    setIsOpen(true);
    setSelectedMetric(metric);
    void load(metric);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    if (audit && audit.metric === selectedMetric) {
      return;
    }
    void load(selectedMetric);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    selectedMetric,
    props.accountId,
    props.asOfDate,
    props.mode,
    props.initialScopeDimension,
    props.initialScopeSymbol,
  ]);

  useEffect(() => {
    if (!props.initialMetric) {
      return;
    }
    setIsOpen(true);
    setSelectedMetric(props.initialMetric);
    void load(props.initialMetric);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    props.initialMetric,
    props.accountId,
    props.asOfDate,
    props.mode,
    props.initialScopeDimension,
    props.initialScopeSymbol,
  ]);

  return (
    <section>
      <h2>Metric Audit</h2>
      <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {METRICS.map((metric) => (
          <button
            key={metric}
            type="button"
            data-testid={`open-audit-${metric}`}
            onClick={() => openWithMetric(metric)}
          >
            {metric}
          </button>
        ))}
      </p>

      {!isOpen ? (
        <p>
          <button type="button" onClick={() => setIsOpen(true)} data-testid="open-audit-drawer-btn">
            Open Audit Drawer
          </button>
        </p>
      ) : null}

      {isOpen ? (
        <aside
          data-testid="metric-audit-drawer"
          style={{
            position: "fixed",
            right: 0,
            top: 0,
            width: "min(560px, 95vw)",
            height: "100vh",
            background: "#fff",
            borderLeft: "1px solid #ddd",
            padding: 16,
            overflowY: "auto",
            boxShadow: "-6px 0 16px rgba(0, 0, 0, 0.12)",
            zIndex: 40,
          }}
        >
          <p style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <strong>Metric Audit Drawer</strong>
            <button type="button" onClick={() => setIsOpen(false)} data-testid="close-audit-drawer-btn">
              Close
            </button>
          </p>
          {loading ? <p>Loading audit...</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          {audit ? (
            <div>
              <h3 data-testid="metric-audit-title">Metric Audit: {audit.metric}</h3>
              <p>As of: {audit.asOfDate}</p>
              <p data-testid="metric-audit-scope">
                Scope: {audit.scope ? `${audit.scope.dimension}=${audit.scope.symbol}` : "none"}
              </p>
              <p>Value: {audit.value == null ? "N/A" : audit.value.toFixed(6)}</p>
              <p>Transactions contributing: {audit.contributors.transactions.length}</p>
              <p>Warnings in scope: {audit.contributors.warnings.length}</p>

              <details open>
                <summary>Holdings ({audit.contributors.holdings.length})</summary>
                <ul>
                  {audit.contributors.holdings.slice(0, 25).map((holding) => (
                    <li key={`${holding.accountId}-${holding.instrumentId ?? holding.symbol}`}>
                      {holding.symbol} ({holding.kind}) value={holding.marketValue.toFixed(2)} weight=
                      {holding.portfolioWeightPct.toFixed(2)}%
                    </li>
                  ))}
                </ul>
              </details>

              <details open>
                <summary>Transactions ({audit.contributors.transactions.length})</summary>
                <ul>
                  {audit.contributors.transactions.slice(0, 50).map((tx) => (
                    <li key={tx.id}>
                      {tx.tradeDate} {tx.type} amount={tx.amount.toFixed(2)} fee={tx.feeAmount.toFixed(2)} delta=
                      {tx.signedCashDelta.toFixed(2)}
                    </li>
                  ))}
                </ul>
              </details>

              <details open>
                <summary>Warnings ({audit.contributors.warnings.length})</summary>
                <ul>
                  {audit.contributors.warnings.slice(0, 50).map((warning, idx) => (
                    <li key={`${warning.code}-${warning.date}-${idx}`}>
                      {warning.date} [{warning.severity}] {warning.code}
                      {warning.message ? `: ${warning.message}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}
