import { getOverviewSnapshot } from "@/src/lib/services/overview-service";

type OverviewPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OverviewPage({ searchParams }: OverviewPageProps) {
  const resolved = (await searchParams) ?? {};
  const modeParam = resolved.mode;
  const modeValue = Array.isArray(modeParam) ? modeParam[0] : modeParam;
  const mode = modeValue === "lookthrough" ? "lookthrough" : "raw";

  const snapshot = await getOverviewSnapshot({ mode });

  return (
    <main style={{ padding: 24 }}>
      <h1>Portfolio Overview</h1>
      <p>As of {snapshot.asOfDate}</p>
      <p>
        Mode: <strong>{snapshot.mode}</strong>
      </p>
      <p>
        <a href="/overview?mode=raw">Raw Holdings</a> |{" "}
        <a href="/overview?mode=lookthrough">Look-through</a>
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
    </main>
  );
}
