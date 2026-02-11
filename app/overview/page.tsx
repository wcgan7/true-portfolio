import { getOverviewSnapshot } from "@/src/lib/services/overview-service";
import type { AuditMetric, AuditScopeDimension } from "@/src/lib/services/audit-service";
import type { OverviewHolding } from "@/src/lib/services/valuation-core";
import { ExposureCharts } from "@/app/overview/exposure-charts";
import { listAccounts } from "@/src/lib/services/account-service";
import { MetricAuditDrawer } from "@/app/overview/metric-audit-drawer";
import type { PerformancePeriod } from "@/src/lib/services/performance-service";
import { getDefaultPortfolioEngines } from "@/src/lib/engines/default-engines";

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
  const assetKinds = toList(resolved.assetKind).map((value) => value.toUpperCase()) as Array<
    OverviewHolding["kind"]
  >;
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
      <p data-testid="overview-performance-period">
        Performance Period: {snapshot.performance.period.type} ({snapshot.performance.period.startDate} to{" "}
        {snapshot.performance.period.endDate})
      </p>
      <p>
        Period:{" "}
        <a href={buildOverviewHref({ period: "since_inception", from: null, to: null })}>Since Inception</a> |{" "}
        <a href={buildOverviewHref({ period: "ytd", from: null, to: null })}>YTD</a> |{" "}
        <a
          href={buildOverviewHref({
            period: "custom",
            from: effectiveCustomFrom,
            to: effectiveCustomTo,
          })}
        >
          Custom
        </a>
      </p>
      <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
        <input type="hidden" name="mode" value={mode} />
        {metric ? <input type="hidden" name="metric" value={metric} /> : null}
        {accountId ? <input type="hidden" name="accountId" value={accountId} /> : null}
        {assetKinds.length ? <input type="hidden" name="assetKind" value={assetKinds.join(",")} /> : null}
        {currencies.length ? <input type="hidden" name="currency" value={currencies.join(",")} /> : null}
        {scopeDimension ? <input type="hidden" name="scopeDimension" value={scopeDimension} /> : null}
        {scopeSymbol ? <input type="hidden" name="scopeSymbol" value={scopeSymbol} /> : null}
        <input type="hidden" name="topN" value={String(topN)} />
        <input type="hidden" name="period" value="custom" />
        <p style={{ margin: 0 }}>
          <label htmlFor="overview-custom-from">From</label>
          <br />
          <input
            id="overview-custom-from"
            name="from"
            type="date"
            defaultValue={effectiveCustomFrom}
            data-testid="overview-custom-from-input"
          />
        </p>
        <p style={{ margin: 0 }}>
          <label htmlFor="overview-custom-to">To</label>
          <br />
          <input
            id="overview-custom-to"
            name="to"
            type="date"
            defaultValue={effectiveCustomTo}
            data-testid="overview-custom-to-input"
          />
        </p>
        <button type="submit" data-testid="overview-apply-custom-period-btn">
          Apply Custom Period
        </button>
      </form>

      <section>
        <h2>Totals</h2>
        <div
          data-testid="kpi-cards-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 12,
          }}
        >
          <article style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: 12, background: "#ffffff" }}>
            <a
              href={buildOverviewHref({ metric: "totalValue", scopeDimension: null, scopeSymbol: null })}
              data-testid="kpi-total-value-link"
            >
              Total Value
            </a>
            <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 700 }}>{snapshot.totals.totalValue.toFixed(2)}</p>
          </article>
          <article style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: 12, background: "#ffffff" }}>
            <a
              href={buildOverviewHref({ metric: "cashValue", scopeDimension: null, scopeSymbol: null })}
              data-testid="kpi-cash-value-link"
            >
              Cash Value
            </a>
            <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 700 }}>{snapshot.totals.cashValue.toFixed(2)}</p>
          </article>
          <article style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: 12, background: "#ffffff" }}>
            <a
              href={buildOverviewHref({ metric: "marketValue", scopeDimension: null, scopeSymbol: null })}
              data-testid="kpi-market-value-link"
            >
              Market Value
            </a>
            <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 700 }}>{snapshot.totals.marketValue.toFixed(2)}</p>
          </article>
          <article style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: 12, background: "#ffffff" }}>
            <a
              href={buildOverviewHref({ metric: "realizedPnl", scopeDimension: null, scopeSymbol: null })}
              data-testid="kpi-realized-pnl-link"
            >
              Realized P&amp;L
            </a>
            <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 700 }}>{snapshot.totals.realizedPnl.toFixed(2)}</p>
          </article>
          <article style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: 12, background: "#ffffff" }}>
            <a
              href={buildOverviewHref({ metric: "unrealizedPnl", scopeDimension: null, scopeSymbol: null })}
              data-testid="kpi-unrealized-pnl-link"
            >
              Unrealized P&amp;L
            </a>
            <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 700 }}>
              {snapshot.totals.unrealizedPnl.toFixed(2)}
            </p>
          </article>
          <article style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: 12, background: "#ffffff" }}>
            <a
              href={buildOverviewHref({ metric: "mwr", scopeDimension: null, scopeSymbol: null })}
              data-testid="kpi-mwr-link"
            >
              MWR
            </a>
            <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 700 }}>
              {snapshot.totals.mwr == null ? "N/A" : `${(snapshot.totals.mwr * 100).toFixed(2)}%`}
            </p>
          </article>
          <article style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: 12, background: "#ffffff" }}>
            <a
              href={buildOverviewHref({ metric: "twr", scopeDimension: null, scopeSymbol: null })}
              data-testid="kpi-twr-link"
            >
              TWR
            </a>
            <p style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 700 }}>
              {snapshot.totals.twr == null ? "N/A" : `${(snapshot.totals.twr * 100).toFixed(2)}%`}
            </p>
          </article>
        </div>
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
        initialScopeDimension={scopeDimension}
        initialScopeSymbol={scopeSymbol}
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
                <tr
                  key={`${holding.accountId}:${holding.instrumentId ?? "none"}:${holding.symbol}:${holding.kind}`}
                >
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
        marketValueAuditHref={buildOverviewHref({
          metric: "marketValue",
          scopeDimension: null,
          scopeSymbol: null,
        })}
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
