"use client";

import { useRouter } from "next/navigation";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Box, Button, Stack, Typography } from "@mui/material";
import { SectionCard } from "@/src/components/ui/section-card";

type ChartRow = {
  key: string;
  marketValue: number;
  portfolioWeightPct: number;
};

type AuditScopeDimension = "holding" | "country" | "sector" | "industry" | "currency";

type ExposureChartsProps = {
  topN: number;
  holdings: ChartRow[];
  countries: ChartRow[];
  sectors: ChartRow[];
  industries: ChartRow[];
  currencies: ChartRow[];
  marketValueAuditHref?: string;
};

function currency(value: number): string {
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function ExposureChart(props: {
  title: string;
  dimension: AuditScopeDimension;
  rows: ChartRow[];
  onPointClick?: (dimension: AuditScopeDimension, row: ChartRow) => void;
}) {
  const handleBarClick = (payload?: { payload?: ChartRow }) => {
    const row = payload?.payload;
    if (!row || !props.onPointClick) {
      return;
    }
    props.onPointClick(props.dimension, row);
  };

  return (
    <SectionCard title={props.title} compact>
      {props.rows.length === 0 ? (
        <Typography color="text.secondary">No data.</Typography>
      ) : (
        <Box>
          <Box sx={{ width: "100%", overflowX: "auto" }}>
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
                    (item?.payload as { portfolioWeightPct?: number } | undefined)
                      ?.portfolioWeightPct ?? 0,
                  );
                  return [`${currency(marketValue)} (${weight.toFixed(2)}%)`, "Value"];
                }}
              />
              <Bar dataKey="marketValue" fill="#0B5CAB" onClick={handleBarClick} cursor="pointer" />
            </BarChart>
          </Box>
          {props.onPointClick ? (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
              {props.rows.slice(0, 8).map((row) => (
                <Button
                  key={`${props.title}-${row.key}`}
                  type="button"
                  size="small"
                  variant="outlined"
                  onClick={() => props.onPointClick?.(props.dimension, row)}
                  data-testid={`chart-point-${props.title}-${row.key}`.replace(/[^a-zA-Z0-9_-]/g, "-")}
                >
                  {row.key}
                </Button>
              ))}
            </Stack>
          ) : null}
        </Box>
      )}
    </SectionCard>
  );
}

export function ExposureCharts(props: ExposureChartsProps) {
  const router = useRouter();
  const onPointClick = props.marketValueAuditHref
    ? (dimension: AuditScopeDimension, row: ChartRow) => {
        const url = new URL(props.marketValueAuditHref!, window.location.origin);
        url.searchParams.set("scopeDimension", dimension);
        url.searchParams.set("scopeSymbol", row.key);
        router.push(`${url.pathname}?${url.searchParams.toString()}`);
      }
    : undefined;

  return (
    <Box component="section">
      <Typography component="h2" variant="h2" sx={{ mb: 1.5 }}>
        Exposure Charts (Top {props.topN})
      </Typography>
      {props.marketValueAuditHref ? (
        <Typography color="text.secondary" sx={{ mb: 1.5 }}>
          Click any bar to open Market Value audit.
        </Typography>
      ) : null}
      <Stack spacing={1.5}>
        <ExposureChart
          title="Holdings Concentration"
          dimension="holding"
          rows={props.holdings}
          onPointClick={onPointClick}
        />
        <ExposureChart
          title="Country Exposure"
          dimension="country"
          rows={props.countries}
          onPointClick={onPointClick}
        />
        <ExposureChart
          title="Sector Exposure"
          dimension="sector"
          rows={props.sectors}
          onPointClick={onPointClick}
        />
        <ExposureChart
          title="Industry Exposure"
          dimension="industry"
          rows={props.industries}
          onPointClick={onPointClick}
        />
        <ExposureChart
          title="Currency Exposure"
          dimension="currency"
          rows={props.currencies}
          onPointClick={onPointClick}
        />
      </Stack>
    </Box>
  );
}
