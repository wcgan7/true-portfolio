import { getOverviewSnapshot } from "@/src/lib/services/overview-service";
import type { AuditMetric } from "@/src/lib/services/audit-service";
import type { OverviewHolding } from "@/src/lib/services/valuation-core";
import { ExposureCharts } from "@/app/overview/exposure-charts";
import { listAccounts } from "@/src/lib/services/account-service";
import { MetricAuditDrawer } from "@/app/overview/metric-audit-drawer";

type OverviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  const resolved = (await searchParams) ?? {};
  const toList = (value: string | string[] | undefined): string[] => {
    if (!value) return [];
    const arr = Array.isArray(value) ? value : [value];
    return arr
      .flatMap((item) => item.split(","))
      .map((item) => item.trim())
      .filter(Boolean);
  };
  const modeParam = resolved.mode;
  const modeValue = Array.isArray(modeParam) ? modeParam[0] : modeParam;
  const mode = modeValue === "lookthrough" ? "lookthrough" : "raw";
  const accountIdParam = resolved.accountId;
  const accountId = Array.isArray(accountIdParam) ? accountIdParam[0] : accountIdParam;
  const assetKinds = toList(resolved.assetKind).map((value) => value.toUpperCase()) as Array<
    OverviewHolding["kind"]
  >;
  const currencies = toList(resolved.currency).map((value) => value.toUpperCase());
  const metricParam = resolved.metric;
  const metricValue = Array.isArray(metricParam) ? metricParam[0] : metricParam;
  const topNParam = resolved.topN;
  const topNRaw = Array.isArray(topNParam) ? topNParam[0] : topNParam;
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

  const snapshot = await getOverviewSnapshot({ mode, assetKinds, currencies, accountId });
  const accounts = await listAccounts();
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
  const topHoldingRows = [...aggregatedHoldings]
    .sort((a, b) => b.marketValue - a.marketValue)
    .slice(0, topN);
  const buildOverviewHref = (overrides: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams();
    const base = {
      mode,
      metric: metric ?? null,
      accountId: accountId ?? null,
      assetKind: assetKinds.join(",") || null,
      currency: currencies.join(",") || null,
      topN: String(topN),
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
    <main style={{ padding: 24 }}>
      <h1>Portfolio Overview</h1>
      <p>As of {snapshot.asOfDate}</p>
      <p>
        Mode: <strong>{snapshot.mode}</strong>
      </p>
      <p>
        <a href={buildOverviewHref({ mode: "raw" })}>Raw Holdings</a> |{" "}
        <a href={buildOverviewHref({ mode: "lookthrough" })}>Look-through</a>
      </p>
      <p>
        Account: <a href={buildOverviewHref({ accountId: null })}>All</a>{" "}
        {accounts.map((account) => (
          <span key={account.id}>
            | <a href={buildOverviewHref({ accountId: account.id })}>{account.name}</a>{" "}
          </span>
        ))}
      </p>
      <p>
        Asset Filter:{" "}
        <a href={buildOverviewHref({ assetKind: null })}>All</a> |{" "}
        <a href={buildOverviewHref({ assetKind: "STOCK" })}>Stocks</a> |{" "}
        <a href={buildOverviewHref({ assetKind: "ETF" })}>ETFs</a> |{" "}
        <a href={buildOverviewHref({ assetKind: "CASH" })}>Cash</a>
      </p>
      <p>
        Currency Filter:{" "}
        <a href={buildOverviewHref({ currency: null })}>All</a> |{" "}
        <a href={buildOverviewHref({ currency: "USD" })}>USD</a>
      </p>
      <p>
        Top-N: <a href={buildOverviewHref({ topN: "5" })}>5</a> |{" "}
        <a href={buildOverviewHref({ topN: "10" })}>10</a> |{" "}
        <a href={buildOverviewHref({ topN: "20" })}>20</a>
      </p>

      <section>
        <h2>Totals</h2>
        <ul>
          <li>Total Value: {snapshot.totals.totalValue.toFixed(2)}</li>
          <li>Cash Value: {snapshot.totals.cashValue.toFixed(2)}</li>
          <li>Market Value: {snapshot.totals.marketValue.toFixed(2)}</li>
          <li>Realized P&amp;L: {snapshot.totals.realizedPnl.toFixed(2)}</li>
          <li>Unrealized P&amp;L: {snapshot.totals.unrealizedPnl.toFixed(2)}</li>
          <li>MWR: {snapshot.totals.mwr == null ? "N/A" : `${(snapshot.totals.mwr * 100).toFixed(2)}%`}</li>
          <li>TWR: {snapshot.totals.twr == null ? "N/A" : `${(snapshot.totals.twr * 100).toFixed(2)}%`}</li>
        </ul>
      </section>

      <section>
        <h2>Data Freshness</h2>
        <ul>
          <li>Scoped Valuation Exists: {snapshot.freshness.scopedValuationExists ? "yes" : "no"}</li>
          <li>
            Scoped Valuation Complete:{" "}
            {snapshot.freshness.scopedValuationComplete == null
              ? "unknown"
              : snapshot.freshness.scopedValuationComplete
                ? "yes"
                : "no"}
          </li>
          <li>Scoped Materialized At: {snapshot.freshness.scopedValuationMaterializedAt ?? "never"}</li>
          <li>Last Materialization: {snapshot.freshness.lastValuationMaterializedAt ?? "never"}</li>
          <li>Last Valuation Date: {snapshot.freshness.lastValuationDate ?? "never"}</li>
          <li>Last Price Fetch: {snapshot.freshness.lastPriceFetchedAt ?? "never"}</li>
        </ul>
      </section>

      <MetricAuditDrawer
        asOfDate={snapshot.asOfDate}
        mode={snapshot.mode}
        accountId={accountId}
        initialMetric={metric}
      />

      {snapshot.lookThrough ? (
        <section>
          <h2>Look-through Coverage</h2>
          <ul>
            <li>Coverage %: {snapshot.lookThrough.coveragePct.toFixed(2)}</li>
            <li>Total ETF Value: {snapshot.lookThrough.totalEtfValue.toFixed(2)}</li>
            <li>Covered ETF Value: {snapshot.lookThrough.coveredEtfValue.toFixed(2)}</li>
            <li>Uncovered ETF Value: {snapshot.lookThrough.uncoveredEtfValue.toFixed(2)}</li>
          </ul>
          <h3>ETF Constituent Staleness</h3>
          {snapshot.lookThrough.staleness.length === 0 ? (
            <p>No ETF holdings in current view.</p>
          ) : (
            <ul>
              {snapshot.lookThrough.staleness.map((row) => (
                <li key={`${row.etfSymbol}-${row.asOfDate ?? "none"}`}>
                  {row.etfSymbol}: {row.asOfDate ?? "No data"}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section>
        <h2>Holdings</h2>
        {snapshot.holdings.length === 0 ? (
          <p>No holdings yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Kind</th>
                <th>Value</th>
                <th>Weight %</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.holdings.map((holding) => (
                <tr key={`${holding.accountId}-${holding.instrumentId ?? "cash"}`}>
                  <td>{holding.symbol}</td>
                  <td>{holding.kind}</td>
                  <td>{holding.marketValue.toFixed(2)}</td>
                  <td>{holding.portfolioWeightPct.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <ExposureCharts
        topN={topN}
        holdings={topHoldingRows}
        countries={snapshot.classifications.byCountry.slice(0, topN)}
        sectors={snapshot.classifications.bySector.slice(0, topN)}
        industries={snapshot.classifications.byIndustry.slice(0, topN)}
        currencies={snapshot.classifications.byCurrency.slice(0, topN)}
      />

      <section>
        <h2>Warnings</h2>
        {snapshot.warnings.length === 0 ? (
          <p>No warnings.</p>
        ) : (
          <ul>
            {snapshot.warnings.map((warning, idx) => (
              <li key={`${warning.code}-${warning.instrumentId}-${idx}`}>{warning.message}</li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2>Classifications</h2>

        <h3>Country Exposure</h3>
        <p>Unclassified: {snapshot.classifications.summaries.country.unclassifiedPct.toFixed(2)}%</p>
        <ul>
          {snapshot.classifications.byCountry.map((row) => (
            <li key={`country-${row.key}`}>
              {row.key}: {row.marketValue.toFixed(2)} ({row.portfolioWeightPct.toFixed(2)}%)
            </li>
          ))}
        </ul>

        <h3>Sector Exposure</h3>
        <p>Unclassified: {snapshot.classifications.summaries.sector.unclassifiedPct.toFixed(2)}%</p>
        <ul>
          {snapshot.classifications.bySector.map((row) => (
            <li key={`sector-${row.key}`}>
              {row.key}: {row.marketValue.toFixed(2)} ({row.portfolioWeightPct.toFixed(2)}%)
            </li>
          ))}
        </ul>

        <h3>Industry Exposure</h3>
        <p>Unclassified: {snapshot.classifications.summaries.industry.unclassifiedPct.toFixed(2)}%</p>
        <ul>
          {snapshot.classifications.byIndustry.map((row) => (
            <li key={`industry-${row.key}`}>
              {row.key}: {row.marketValue.toFixed(2)} ({row.portfolioWeightPct.toFixed(2)}%)
            </li>
          ))}
        </ul>

        <h3>Currency Exposure</h3>
        <p>Unclassified: {snapshot.classifications.summaries.currency.unclassifiedPct.toFixed(2)}%</p>
        <ul>
          {snapshot.classifications.byCurrency.map((row) => (
            <li key={`currency-${row.key}`}>
              {row.key}: {row.marketValue.toFixed(2)} ({row.portfolioWeightPct.toFixed(2)}%)
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
