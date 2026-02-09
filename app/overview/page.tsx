import { getOverviewSnapshot } from "@/src/lib/services/overview-service";

export default async function OverviewPage() {
  const snapshot = await getOverviewSnapshot();

  return (
    <main style={{ padding: 24 }}>
      <h1>Portfolio Overview</h1>
      <p>As of {snapshot.asOfDate}</p>

      <section>
        <h2>Totals</h2>
        <ul>
          <li>Total Value: {snapshot.totals.totalValue.toFixed(2)}</li>
          <li>Cash Value: {snapshot.totals.cashValue.toFixed(2)}</li>
          <li>Market Value: {snapshot.totals.marketValue.toFixed(2)}</li>
          <li>Realized P&amp;L: {snapshot.totals.realizedPnl.toFixed(2)}</li>
          <li>Unrealized P&amp;L: {snapshot.totals.unrealizedPnl.toFixed(2)}</li>
        </ul>
      </section>

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

