"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  Stack,
  Typography,
} from "@mui/material";
import { InlineAlert } from "@/src/components/ui/inline-alert";

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
  const [selectedMetric, setSelectedMetric] = useState<AuditMetric>(props.initialMetric ?? "totalValue");
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
    <Box component="section">
      <Typography component="h2" variant="h2" sx={{ mb: 1.25 }}>
        Metric Audit
      </Typography>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
        {METRICS.map((metric) => (
          <Button
            key={metric}
            type="button"
            size="small"
            variant={selectedMetric === metric ? "contained" : "outlined"}
            data-testid={`open-audit-${metric}`}
            onClick={() => openWithMetric(metric)}
          >
            {metric}
          </Button>
        ))}
      </Stack>

      {!isOpen ? (
        <Button type="button" onClick={() => setIsOpen(true)} data-testid="open-audit-drawer-btn" variant="outlined">
          Open Audit Drawer
        </Button>
      ) : null}

      <Drawer
        anchor="right"
        open={isOpen}
        onClose={() => setIsOpen(false)}
        data-testid="metric-audit-drawer"
      >
        <Box sx={{ width: "min(560px, 95vw)", p: 2.25 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography component="strong" sx={{ fontWeight: 700 }}>
              Metric Audit Drawer
            </Typography>
            <Button type="button" onClick={() => setIsOpen(false)} data-testid="close-audit-drawer-btn">
              Close
            </Button>
          </Stack>
          <Typography component="h3" variant="h3" data-testid="metric-audit-title" sx={{ mb: 1.25 }}>
            Metric Audit: {audit?.metric ?? selectedMetric}
          </Typography>
          {loading ? <Typography>Loading audit...</Typography> : null}
          {error ? <InlineAlert severity="error">{error}</InlineAlert> : null}
          {audit ? (
            <Stack spacing={1.4}>
              <Typography>As of: {audit.asOfDate}</Typography>
              <Typography data-testid="metric-audit-scope">
                Scope: {audit.scope ? `${audit.scope.dimension}=${audit.scope.symbol}` : "none"}
              </Typography>
              <Typography>Value: {audit.value == null ? "N/A" : audit.value.toFixed(6)}</Typography>
              <Typography>Transactions contributing: {audit.contributors.transactions.length}</Typography>
              <Typography>Warnings in scope: {audit.contributors.warnings.length}</Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`Holdings: ${audit.contributors.holdings.length}`} size="small" />
                <Chip label={`Transactions: ${audit.contributors.transactions.length}`} size="small" />
                <Chip label={`Warnings: ${audit.contributors.warnings.length}`} size="small" />
              </Stack>

              <Divider />

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
            </Stack>
          ) : null}
        </Box>
      </Drawer>
    </Box>
  );
}
