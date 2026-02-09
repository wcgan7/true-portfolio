"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartRow = {
  key: string;
  marketValue: number;
  portfolioWeightPct: number;
};

type ExposureChartsProps = {
  topN: number;
  holdings: ChartRow[];
  countries: ChartRow[];
  sectors: ChartRow[];
  industries: ChartRow[];
  currencies: ChartRow[];
};

function currency(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function ExposureChart(props: { title: string; rows: ChartRow[] }) {
  return (
    <section>
      <h3>{props.title}</h3>
      {props.rows.length === 0 ? (
        <p>No data.</p>
      ) : (
        <div style={{ width: "100%", overflowX: "auto" }}>
          <BarChart
            data={props.rows}
            width={Math.max(720, props.rows.length * 96)}
            height={280}
            margin={{ top: 12, right: 16, bottom: 12, left: 12 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="key" interval={0} angle={-20} textAnchor="end" height={70} />
            <YAxis tickFormatter={(v: number) => currency(v)} width={90} />
            <Tooltip
              formatter={(value, _name, item) => {
                const marketValue = Number(value ?? 0);
                const weight = Number(
                  (item?.payload as { portfolioWeightPct?: number } | undefined)?.portfolioWeightPct ??
                    0,
                );
                return [`${currency(marketValue)} (${weight.toFixed(2)}%)`, "Value"];
              }}
            />
            <Bar dataKey="marketValue" fill="#155e75" />
          </BarChart>
        </div>
      )}
    </section>
  );
}

export function ExposureCharts(props: ExposureChartsProps) {
  return (
    <section>
      <h2>Exposure Charts (Top {props.topN})</h2>
      <ExposureChart title="Holdings Concentration" rows={props.holdings} />
      <ExposureChart title="Country Exposure" rows={props.countries} />
      <ExposureChart title="Sector Exposure" rows={props.sectors} />
      <ExposureChart title="Industry Exposure" rows={props.industries} />
      <ExposureChart title="Currency Exposure" rows={props.currencies} />
    </section>
  );
}
