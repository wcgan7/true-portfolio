import { getOverviewSnapshot } from "@/src/lib/services/overview-service";
import type { AuditMetric, AuditScopeDimension } from "@/src/lib/services/audit-service";
import type { OverviewHolding } from "@/src/lib/services/valuation-core";
import { ExposureCharts } from "@/app/overview/exposure-charts";
import { listAccounts } from "@/src/lib/services/account-service";
import { MetricAuditDrawer } from "@/app/overview/metric-audit-drawer";
import type { PerformancePeriod } from "@/src/lib/services/performance-service";
import { getDefaultPortfolioEngines } from "@/src/lib/engines/default-engines";
import {
  Box,
  Button,
  Chip,
  Link,
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
import { KpiCard } from "@/src/components/ui/kpi-card";
import { PageHeader } from "@/src/components/ui/page-header";
import { SectionCard } from "@/src/components/ui/section-card";
import { formatCurrency, formatNumber, formatPercent } from "@/src/components/ui/metric-value";

type OverviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  const resolved = (await searchParams) ?? {};
  const firstParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const toList = (value: string | string[] | undefined): string[] => {
    if (!value) return [];
    const arr = Array.isArray(value) ? value : [value];
    return arr
      .flatMap((item) => item.split(","))
      .map((item) => item.trim())
      .filter(Boolean);
  };
  const modeValue = firstParam(resolved.mode);
  const mode = modeValue === "lookthrough" ? "lookthrough" : "raw";
  const accountId = firstParam(resolved.accountId);
  const assetKinds = toList(resolved.assetKind).map((value) => value.toUpperCase()) as Array<OverviewHolding["kind"]>;
  const currencies = toList(resolved.currency).map((value) => value.toUpperCase());
  const metricValue = firstParam(resolved.metric);
  const scopeDimensionValue = firstParam(resolved.scopeDimension);
  const scopeSymbolValue = firstParam(resolved.scopeSymbol);
  const topNRaw = firstParam(resolved.topN);
  const periodValue = firstParam(resolved.period);
  const period: PerformancePeriod =
    periodValue === "custom" || periodValue === "ytd" ? periodValue : "since_inception";
  const fromRaw = firstParam(resolved.from);
  const toRaw = firstParam(resolved.to);
  const parseDate = (value?: string) => {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed;
  };
  const from = parseDate(fromRaw);
  const to = parseDate(toRaw);
  const customFromDefault = from ? from.toISOString().slice(0, 10) : undefined;
  const customToDefault = to ? to.toISOString().slice(0, 10) : undefined;
  const parsedTopN = topNRaw ? Number(topNRaw) : 10;
  const topN = Number.isFinite(parsedTopN) ? Math.max(3, Math.min(25, Math.floor(parsedTopN))) : 10;
  const metric = ([
    "totalValue",
    "marketValue",
    "cashValue",
    "realizedPnl",
    "unrealizedPnl",
    "mwr",
    "twr",
  ] as const).includes(metricValue as AuditMetric)
    ? (metricValue as AuditMetric)
    : null;
  const scopeDimension = (["holding", "country", "sector", "industry", "currency"] as const).includes(
    scopeDimensionValue as AuditScopeDimension,
  )
    ? (scopeDimensionValue as AuditScopeDimension)
    : undefined;
  const scopeSymbol = scopeSymbolValue?.trim() || undefined;

  const snapshot = await getOverviewSnapshot({
    mode,
    assetKinds,
    currencies,
    accountId,
    period,
    from,
    to,
    engines: getDefaultPortfolioEngines(),
  });
  const accounts = await listAccounts();
  const effectiveCustomFrom = customFromDefault ?? snapshot.performance.period.startDate;
  const effectiveCustomTo = customToDefault ?? snapshot.performance.period.endDate;
  const aggregatedHoldings = [...snapshot.holdings]
    .reduce(
      (map, holding) => {
        const existing = map.get(holding.symbol);
        if (!existing) {
          map.set(holding.symbol, {
            key: holding.symbol,
            marketValue: holding.marketValue,
            portfolioWeightPct: holding.portfolioWeightPct,
          });
          return map;
        }
        existing.marketValue += holding.marketValue;
        existing.portfolioWeightPct += holding.portfolioWeightPct;
        return map;
      },
      new Map<string, { key: string; marketValue: number; portfolioWeightPct: number }>(),
    )
    .values();
  const topHoldingRows = [...aggregatedHoldings].sort((a, b) => b.marketValue - a.marketValue).slice(0, topN);
  const buildOverviewHref = (overrides: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams();
    const base = {
      mode,
      metric: metric ?? null,
      accountId: accountId ?? null,
      assetKind: assetKinds.join(",") || null,
      currency: currencies.join(",") || null,
      period,
      from: period === "custom" ? (from ? from.toISOString().slice(0, 10) : null) : null,
      to: period === "custom" ? (to ? to.toISOString().slice(0, 10) : null) : null,
      topN: String(topN),
      scopeDimension: scopeDimension ?? null,
      scopeSymbol: scopeSymbol ?? null,
      ...overrides,
    };
    for (const [key, value] of Object.entries(base)) {
      if (value == null || value === "") continue;
      params.set(key, value);
    }
    const query = params.toString();
    return query ? `/overview?${query}` : "/overview";
  };

  return (
    <Box component="main" sx={{ display: "grid", gap: 2.5 }}>
      <PageHeader title="Portfolio Overview" subtitle={`As of ${snapshot.asOfDate}`} />

      <SectionCard compact>
        <Stack spacing={1}>
          <Typography>
            Mode: <strong>{snapshot.mode}</strong>
          </Typography>
          <Typography>
            <Link href={buildOverviewHref({ mode: "raw" })}>Raw Holdings</Link> |{" "}
            <Link href={buildOverviewHref({ mode: "lookthrough" })}>Look-through</Link>
          </Typography>
          <Typography>
            Account: <Link href={buildOverviewHref({ accountId: null })}>All</Link>{" "}
            {accounts.map((account) => (
              <Box key={account.id} component="span" sx={{ ml: 0.5 }}>
                | <Link href={buildOverviewHref({ accountId: account.id })}>{account.name}</Link>{" "}
              </Box>
            ))}
          </Typography>
          <Typography>
            Asset Filter: <Link href={buildOverviewHref({ assetKind: null })}>All</Link> |{" "}
            <Link href={buildOverviewHref({ assetKind: "STOCK" })}>Stocks</Link> |{" "}
            <Link href={buildOverviewHref({ assetKind: "ETF" })}>ETFs</Link> |{" "}
            <Link href={buildOverviewHref({ assetKind: "CASH" })}>Cash</Link>
          </Typography>
          <Typography>
            Currency Filter: <Link href={buildOverviewHref({ currency: null })}>All</Link> |{" "}
            <Link href={buildOverviewHref({ currency: "USD" })}>USD</Link>
          </Typography>
          <Typography>
            Top-N: <Link href={buildOverviewHref({ topN: "5" })}>5</Link> |{" "}
            <Link href={buildOverviewHref({ topN: "10" })}>10</Link> |{" "}
            <Link href={buildOverviewHref({ topN: "20" })}>20</Link>
          </Typography>
          <Typography data-testid="overview-performance-period">
            Performance Period: {snapshot.performance.period.type} ({snapshot.performance.period.startDate} to{" "}
            {snapshot.performance.period.endDate})
          </Typography>
          <Typography>
            Period:{" "}
            <Link href={buildOverviewHref({ period: "since_inception", from: null, to: null })}>Since Inception</Link> |{" "}
            <Link href={buildOverviewHref({ period: "ytd", from: null, to: null })}>YTD</Link> |{" "}
            <Link
              href={buildOverviewHref({
                period: "custom",
                from: effectiveCustomFrom,
                to: effectiveCustomTo,
              })}
            >
              Custom
            </Link>
          </Typography>
          <Box component="form" method="get" sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "end" }}>
            <input type="hidden" name="mode" value={mode} />
            {metric ? <input type="hidden" name="metric" value={metric} /> : null}
            {accountId ? <input type="hidden" name="accountId" value={accountId} /> : null}
            {assetKinds.length ? <input type="hidden" name="assetKind" value={assetKinds.join(",")} /> : null}
            {currencies.length ? <input type="hidden" name="currency" value={currencies.join(",")} /> : null}
            {scopeDimension ? <input type="hidden" name="scopeDimension" value={scopeDimension} /> : null}
            {scopeSymbol ? <input type="hidden" name="scopeSymbol" value={scopeSymbol} /> : null}
            <input type="hidden" name="topN" value={String(topN)} />
            <input type="hidden" name="period" value="custom" />
            <TextField
              id="overview-custom-from"
              name="from"
              label="From"
              type="date"
              defaultValue={effectiveCustomFrom}
              InputLabelProps={{ shrink: true }}
              inputProps={{ "data-testid": "overview-custom-from-input" }}
              size="small"
            />
            <TextField
              id="overview-custom-to"
              name="to"
              label="To"
              type="date"
              defaultValue={effectiveCustomTo}
              InputLabelProps={{ shrink: true }}
              inputProps={{ "data-testid": "overview-custom-to-input" }}
              size="small"
            />
            <Button type="submit" variant="contained" data-testid="overview-apply-custom-period-btn">
              Apply Custom Period
            </Button>
          </Box>
        </Stack>
      </SectionCard>

      <SectionCard title="Totals">
        <Box
          data-testid="kpi-cards-grid"
          sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1.5 }}
        >
          <KpiCard
            label="Total Value"
            href={buildOverviewHref({ metric: "totalValue", scopeDimension: null, scopeSymbol: null })}
            value={formatCurrency(snapshot.totals.totalValue)}
            testId="kpi-total-value-link"
          />
          <KpiCard
            label="Cash Value"
            href={buildOverviewHref({ metric: "cashValue", scopeDimension: null, scopeSymbol: null })}
            value={formatCurrency(snapshot.totals.cashValue)}
            testId="kpi-cash-value-link"
          />
          <KpiCard
            label="Market Value"
            href={buildOverviewHref({ metric: "marketValue", scopeDimension: null, scopeSymbol: null })}
            value={formatCurrency(snapshot.totals.marketValue)}
            testId="kpi-market-value-link"
          />
          <KpiCard
            label="Realized P&L"
            href={buildOverviewHref({ metric: "realizedPnl", scopeDimension: null, scopeSymbol: null })}
            value={formatCurrency(snapshot.totals.realizedPnl)}
            testId="kpi-realized-pnl-link"
          />
          <KpiCard
            label="Unrealized P&L"
            href={buildOverviewHref({ metric: "unrealizedPnl", scopeDimension: null, scopeSymbol: null })}
            value={formatCurrency(snapshot.totals.unrealizedPnl)}
            testId="kpi-unrealized-pnl-link"
          />
          <KpiCard
            label="MWR"
            href={buildOverviewHref({ metric: "mwr", scopeDimension: null, scopeSymbol: null })}
            value={formatPercent(snapshot.totals.mwr)}
            testId="kpi-mwr-link"
          />
          <KpiCard
            label="TWR"
            href={buildOverviewHref({ metric: "twr", scopeDimension: null, scopeSymbol: null })}
            value={formatPercent(snapshot.totals.twr)}
            testId="kpi-twr-link"
          />
        </Box>
      </SectionCard>

      <SectionCard title="Data Freshness">
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip label={`Scoped Valuation Exists: ${snapshot.freshness.scopedValuationExists ? "yes" : "no"}`} />
          <Chip
            label={`Scoped Valuation Complete: ${
              snapshot.freshness.scopedValuationComplete == null
                ? "unknown"
                : snapshot.freshness.scopedValuationComplete
                  ? "yes"
                  : "no"
            }`}
          />
          <Chip label={`Scoped Materialized At: ${snapshot.freshness.scopedValuationMaterializedAt ?? "never"}`} />
          <Chip label={`Last Materialization: ${snapshot.freshness.lastValuationMaterializedAt ?? "never"}`} />
          <Chip label={`Last Valuation Date: ${snapshot.freshness.lastValuationDate ?? "never"}`} />
          <Chip label={`Last Price Fetch: ${snapshot.freshness.lastPriceFetchedAt ?? "never"}`} />
        </Stack>
      </SectionCard>

      <MetricAuditDrawer
        asOfDate={snapshot.asOfDate}
        mode={snapshot.mode}
        accountId={accountId}
        initialMetric={metric}
        initialScopeDimension={scopeDimension}
        initialScopeSymbol={scopeSymbol}
      />

      {snapshot.lookThrough ? (
        <SectionCard title="Look-through Coverage">
          <Stack spacing={1}>
            <Typography>Coverage %: {snapshot.lookThrough.coveragePct.toFixed(2)}</Typography>
            <Typography>Total ETF Value: {formatCurrency(snapshot.lookThrough.totalEtfValue)}</Typography>
            <Typography>Covered ETF Value: {formatCurrency(snapshot.lookThrough.coveredEtfValue)}</Typography>
            <Typography>Uncovered ETF Value: {formatCurrency(snapshot.lookThrough.uncoveredEtfValue)}</Typography>

            <Typography component="h3" variant="h3" sx={{ mt: 1 }}>
              ETF Constituent Staleness
            </Typography>
            {snapshot.lookThrough.staleness.length === 0 ? (
              <EmptyState title="No ETF holdings in current view." />
            ) : (
              <Stack component="ul" sx={{ m: 0, pl: 2 }}>
                {snapshot.lookThrough.staleness.map((row) => (
                  <li key={`${row.etfSymbol}-${row.asOfDate ?? "none"}`}>
                    {row.etfSymbol}: {row.asOfDate ?? "No data"}
                  </li>
                ))}
              </Stack>
            )}
          </Stack>
        </SectionCard>
      ) : null}

      <SectionCard title="Holdings">
        {snapshot.holdings.length === 0 ? (
          <EmptyState title="No holdings yet." />
        ) : (
          <DataTable compact>
            <TableHead>
              <TableRow>
                <TableCell>Symbol</TableCell>
                <TableCell>Kind</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Weight %</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {snapshot.holdings.map((holding) => (
                <TableRow key={`${holding.accountId}:${holding.instrumentId ?? "none"}:${holding.symbol}:${holding.kind}`}>
                  <TableCell>{holding.symbol}</TableCell>
                  <TableCell>{holding.kind}</TableCell>
                  <TableCell>{formatNumber(holding.marketValue)}</TableCell>
                  <TableCell>{holding.portfolioWeightPct.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        )}
      </SectionCard>

      <ExposureCharts
        topN={topN}
        holdings={topHoldingRows}
        countries={snapshot.classifications.byCountry.slice(0, topN)}
        sectors={snapshot.classifications.bySector.slice(0, topN)}
        industries={snapshot.classifications.byIndustry.slice(0, topN)}
        currencies={snapshot.classifications.byCurrency.slice(0, topN)}
        marketValueAuditHref={buildOverviewHref({
          metric: "marketValue",
          scopeDimension: null,
          scopeSymbol: null,
        })}
      />

      <SectionCard title="Warnings">
        {snapshot.warnings.length === 0 ? (
          <EmptyState title="No warnings." />
        ) : (
          <Stack component="ul" sx={{ m: 0, pl: 2 }}>
            {snapshot.warnings.map((warning, idx) => (
              <li key={`${warning.code}-${warning.instrumentId}-${idx}`}>{warning.message}</li>
            ))}
          </Stack>
        )}
      </SectionCard>

      <SectionCard title="Classifications">
        <Stack spacing={2}>
          <Box>
            <Typography component="h3" variant="h3">
              Country Exposure
            </Typography>
            <Typography sx={{ mb: 0.75 }}>
              Unclassified: {snapshot.classifications.summaries.country.unclassifiedPct.toFixed(2)}%
            </Typography>
            <Stack component="ul" sx={{ m: 0, pl: 2 }}>
              {snapshot.classifications.byCountry.map((row) => (
                <li key={`country-${row.key}`}>
                  {row.key}: {formatNumber(row.marketValue)} ({row.portfolioWeightPct.toFixed(2)}%)
                </li>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography component="h3" variant="h3">
              Sector Exposure
            </Typography>
            <Typography sx={{ mb: 0.75 }}>
              Unclassified: {snapshot.classifications.summaries.sector.unclassifiedPct.toFixed(2)}%
            </Typography>
            <Stack component="ul" sx={{ m: 0, pl: 2 }}>
              {snapshot.classifications.bySector.map((row) => (
                <li key={`sector-${row.key}`}>
                  {row.key}: {formatNumber(row.marketValue)} ({row.portfolioWeightPct.toFixed(2)}%)
                </li>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography component="h3" variant="h3">
              Industry Exposure
            </Typography>
            <Typography sx={{ mb: 0.75 }}>
              Unclassified: {snapshot.classifications.summaries.industry.unclassifiedPct.toFixed(2)}%
            </Typography>
            <Stack component="ul" sx={{ m: 0, pl: 2 }}>
              {snapshot.classifications.byIndustry.map((row) => (
                <li key={`industry-${row.key}`}>
                  {row.key}: {formatNumber(row.marketValue)} ({row.portfolioWeightPct.toFixed(2)}%)
                </li>
              ))}
            </Stack>
          </Box>

          <Box>
            <Typography component="h3" variant="h3">
              Currency Exposure
            </Typography>
            <Typography sx={{ mb: 0.75 }}>
              Unclassified: {snapshot.classifications.summaries.currency.unclassifiedPct.toFixed(2)}%
            </Typography>
            <Stack component="ul" sx={{ m: 0, pl: 2 }}>
              {snapshot.classifications.byCurrency.map((row) => (
                <li key={`currency-${row.key}`}>
                  {row.key}: {formatNumber(row.marketValue)} ({row.portfolioWeightPct.toFixed(2)}%)
                </li>
              ))}
            </Stack>
          </Box>
        </Stack>
      </SectionCard>
    </Box>
  );
}
