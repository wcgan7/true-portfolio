"use client";

import { FormEvent, useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";
import {
  Box,
  Button,
  LinearProgress,
  Stack,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { DataTable } from "@/src/components/ui/data-table";
import { EmptyState } from "@/src/components/ui/empty-state";
import { FormSection } from "@/src/components/ui/form-section";
import { InlineAlert } from "@/src/components/ui/inline-alert";
import { PageHeader } from "@/src/components/ui/page-header";
import { SectionCard } from "@/src/components/ui/section-card";

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

type RefreshStatus = {
  lastPriceFetchedAt: string | null;
  lastValuationMaterializedAt: string | null;
  lastValuationDate: string | null;
};

type RefreshRunResult = {
  price: {
    pointsUpserted: number;
    processedSymbols: string[];
  };
  valuation: RecomputeResult;
  status: RefreshStatus;
};

type RefreshJob = {
  id: string;
  status: "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED_CONFLICT";
  trigger: "MANUAL" | "SCHEDULED";
  startedAt: string;
  finishedAt: string | null;
  errorMessage: string | null;
};

export default function ValuationsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [rows, setRows] = useState<DailyValuation[]>([]);
  const [accountId, setAccountId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<RecomputeResult | null>(null);
  const [refreshStatus, setRefreshStatus] = useState<RefreshStatus | null>(null);
  const [lastRefreshRun, setLastRefreshRun] = useState<RefreshRunResult | null>(null);
  const [refreshJobs, setRefreshJobs] = useState<RefreshJob[]>([]);

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

  async function loadRefreshStatus() {
    const res = await fetch("/api/valuations/refresh");
    const payload = (await res.json()) as { data?: RefreshStatus; error?: string };
    if (!res.ok || !payload.data) {
      throw new Error(payload.error ?? "Failed to load refresh status");
    }
    setRefreshStatus(payload.data);
  }

  async function loadRefreshJobs() {
    const res = await fetch("/api/valuations/refresh/jobs?limit=10");
    const payload = (await res.json()) as { data?: RefreshJob[]; error?: string };
    if (!res.ok || !payload.data) {
      throw new Error(payload.error ?? "Failed to load refresh jobs");
    }
    setRefreshJobs(payload.data);
    return payload.data;
  }

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([loadAccounts(), loadRows(), loadRefreshStatus(), loadRefreshJobs()]);
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

  useEffect(() => {
    if (!refreshJobs.some((job) => job.status === "RUNNING")) {
      return;
    }

    const poll = async () => {
      try {
        const jobs = await loadRefreshJobs();
        const stillRunning = jobs.some((job) => job.status === "RUNNING");
        if (!stillRunning) {
          await Promise.all([
            loadRefreshStatus(),
            loadRows({ accountId: accountId || undefined, from: from || undefined, to: to || undefined }),
          ]);
        }
      } catch {
        // Best-effort polling: keep the existing UI stable if polling temporarily fails.
      }
    };

    void poll();
    const timer = setInterval(() => {
      void poll();
    }, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [refreshJobs, accountId, from, to]);

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

  async function onRunFullRefresh() {
    setError(null);
    if (from && to && from > to) {
      setError("from must be <= to");
      return;
    }
    setRefreshing(true);
    try {
      const res = await fetch("/api/valuations/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          accountId: accountId || undefined,
          from: from || undefined,
          to: to || undefined,
        }),
      });
      const payload = (await res.json()) as { data?: RefreshRunResult; error?: string };
      if (!res.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to run full refresh");
      }
      setLastRefreshRun(payload.data);
      setRefreshStatus(payload.data.status);
      await loadRows({ accountId: accountId || undefined, from: from || undefined, to: to || undefined });
      await loadRefreshJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run full refresh");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <Box component="main">
      <PageHeader title="Valuations" subtitle="Materialize and review daily valuation rows." />

      <Stack spacing={2.5}>
        <FormSection title="Recompute Daily Valuations">
          <Box component="form" onSubmit={onRecompute} sx={{ display: "grid", gap: 2, maxWidth: 640 }}>
            <Box>
              <label htmlFor="val-account">Account</label>
              <Box
                component="select"
                id="val-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                data-testid="valuation-account-select"
                sx={{
                  mt: 0.5,
                  width: "100%",
                  borderRadius: 1.25,
                  border: "1px solid",
                  borderColor: "divider",
                  px: 1.25,
                  py: 1,
                  bgcolor: "background.paper",
                }}
              >
                <option value="">All accounts + portfolio</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Box>
            </Box>

            <TextField
              id="val-from"
              label="From"
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ "data-testid": "valuation-from-input" }}
            />

            <TextField
              id="val-to"
              label="To"
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ "data-testid": "valuation-to-input" }}
            />

            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <Button type="submit" disabled={submitting} data-testid="recompute-valuations-btn" variant="contained">
                {submitting ? "Recomputing..." : "Recompute"}
              </Button>
              <Button
                type="button"
                onClick={() => void onRunFullRefresh()}
                disabled={refreshing}
                data-testid="run-full-refresh-btn"
                variant="outlined"
              >
                {refreshing ? "Refreshing..." : "Refresh Prices + Recompute"}
              </Button>
              <Button type="button" onClick={() => void onApplyFilter()} data-testid="load-valuations-btn" variant="text">
                Load Rows
              </Button>
            </Stack>
          </Box>
        </FormSection>

        {loading ? <LinearProgress /> : null}
        {error ? <InlineAlert severity="error">{error}</InlineAlert> : null}

        {lastResult ? (
          <SectionCard title="Last Recompute" compact>
            <Typography data-testid="valuation-last-result">
              {lastResult.from} to {lastResult.to} | dates={lastResult.datesProcessed} | rows={lastResult.rowsUpserted}
            </Typography>
          </SectionCard>
        ) : null}

        {refreshStatus ? (
          <SectionCard title="Last Pipeline Status" compact>
            <Typography data-testid="valuation-refresh-status">
              Last prices fetched: {refreshStatus.lastPriceFetchedAt ?? "never"} | Last materialized:{" "}
              {refreshStatus.lastValuationMaterializedAt ?? "never"} | Last valuation date:{" "}
              {refreshStatus.lastValuationDate ?? "never"}
            </Typography>
          </SectionCard>
        ) : null}

        {lastRefreshRun ? (
          <SectionCard title="Last Full Refresh" compact>
            <Typography data-testid="valuation-refresh-run-result">
              prices={lastRefreshRun.price.pointsUpserted} points, symbols=
              {lastRefreshRun.price.processedSymbols.length}, rows={lastRefreshRun.valuation.rowsUpserted}
            </Typography>
          </SectionCard>
        ) : null}

        <SectionCard title="Recent Refresh Jobs">
          {refreshJobs.length === 0 ? (
            <EmptyState title="No jobs yet." />
          ) : (
            <DataTable testId="refresh-jobs-table" compact>
              <TableHead>
                <TableRow>
                  <TableCell>Started</TableCell>
                  <TableCell>Trigger</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Finished</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {refreshJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{new Date(job.startedAt).toISOString()}</TableCell>
                    <TableCell>{job.trigger}</TableCell>
                    <TableCell>{job.status}</TableCell>
                    <TableCell>{job.finishedAt ? new Date(job.finishedAt).toISOString() : "running"}</TableCell>
                    <TableCell>{job.errorMessage ?? "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </DataTable>
          )}
        </SectionCard>

        <SectionCard title="Persisted Daily Valuations">
          {!loading && rows.length === 0 ? <EmptyState title="No rows found." /> : null}
          {!loading && rows.length > 0 ? (
            <Box>
              <Typography variant="h3" component="h3" sx={{ mb: 1.5 }}>
                Valuation Series
              </Typography>
              <Box sx={{ width: "100%", overflowX: "auto", mb: 2 }}>
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
                  <Line type="monotone" dataKey="totalValue" stroke="#0B5CAB" strokeWidth={2} dot={false} />
                </LineChart>
              </Box>

              <DataTable testId="valuations-table" compact>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Account</TableCell>
                    <TableCell>Cash</TableCell>
                    <TableCell>Market</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell>Complete</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{new Date(row.date).toISOString().slice(0, 10)}</TableCell>
                      <TableCell>{row.accountId ?? "PORTFOLIO"}</TableCell>
                      <TableCell>{Number(row.cashValue).toFixed(2)}</TableCell>
                      <TableCell>{Number(row.marketValue).toFixed(2)}</TableCell>
                      <TableCell>{Number(row.totalValue).toFixed(2)}</TableCell>
                      <TableCell>{row.completenessFlag ? "yes" : "no"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </Box>
          ) : null}
        </SectionCard>
      </Stack>
    </Box>
  );
}
