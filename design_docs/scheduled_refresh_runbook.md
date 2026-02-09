# Scheduled Refresh Runbook

This runbook covers automated execution of the scheduled valuation refresh endpoint.

## Endpoint Contract

- Method: `POST`
- Path: `/api/valuations/refresh/scheduled`
- Auth header: `x-cron-secret: <VALUATION_REFRESH_CRON_SECRET>`
- Body: optional JSON accepted by the manual refresh schema:
  - `accountId?: string`
  - `symbols?: string[]`
  - `from?: YYYY-MM-DD`
  - `to?: YYYY-MM-DD`

Response:
- `200`: refresh run accepted and executed, returns `{ data: { jobId, price, valuation, status } }`
- `401`: missing/incorrect cron secret
- `400`: invalid payload
- `409`: refresh lock already held (job recorded as `SKIPPED_CONFLICT`)
- `500`: server-side failure (job recorded as `FAILED` when a run starts)

## Required Environment

- `DATABASE_URL`
- `POLYGON_API_KEY`
- `VALUATION_REFRESH_CRON_SECRET`

## Manual Verification

Run a one-off scheduled call locally:

```bash
curl -sS -X POST "http://localhost:3000/api/valuations/refresh/scheduled" \
  -H "content-type: application/json" \
  -H "x-cron-secret: ${VALUATION_REFRESH_CRON_SECRET}" \
  -d '{"from":"2026-01-01","to":"2026-01-31"}'
```

Then verify recent jobs:

```bash
curl -sS "http://localhost:3000/api/valuations/refresh/jobs?limit=10"
```

Jobs API supports server-side filters/pagination:
- `limit` (default 20, max 100)
- `offset` (default 0)
- `status` (`RUNNING|SUCCEEDED|FAILED|SKIPPED_CONFLICT`)
- `trigger` (`MANUAL|SCHEDULED`)

Alert report API:
- `GET /api/valuations/refresh/alerts?lookbackHours=24`
- Returns failure/success totals, latest success/failure timestamps, and `alert.shouldWarn` with reason strings.

## Scheduler Wiring

Use any scheduler (Vercel Cron, GitHub Actions, Cloud Scheduler, etc.) to call the endpoint. Keep cadence conservative in MVP (for example every 15-60 minutes during market hours).

Example GitHub Actions cron:

```yaml
name: Scheduled Valuation Refresh

on:
  schedule:
    - cron: "*/30 13-21 * * 1-5" # every 30 min, weekday US market hours (UTC)
  workflow_dispatch:

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger refresh
        run: |
          curl -f -X POST "${APP_BASE_URL}/api/valuations/refresh/scheduled" \
            -H "content-type: application/json" \
            -H "x-cron-secret: ${VALUATION_REFRESH_CRON_SECRET}" \
            -d '{}'
        env:
          APP_BASE_URL: ${{ secrets.APP_BASE_URL }}
          VALUATION_REFRESH_CRON_SECRET: ${{ secrets.VALUATION_REFRESH_CRON_SECRET }}
```

## Failure Handling and Alerts

Monitor for either condition:
- repeated `FAILED` jobs in `/api/valuations/refresh/jobs`
- stale freshness in `/api/valuations/refresh` (`lastPriceFetchedAt` and `lastValuationMaterializedAt` lagging expected cadence)

Recommended alert policy:
- warning: no successful scheduled run in >2 expected intervals
- critical: 3 consecutive `FAILED` jobs

## Operational Notes

- Concurrency is protected by advisory lock; overlapping schedules are safe and return `409`.
- `SKIPPED_CONFLICT` is expected if a refresh is already active.
- Keep `VALUATION_REFRESH_CRON_SECRET` rotated and scoped as a secret in your deployment platform.
