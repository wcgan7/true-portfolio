# v1 Acceptance Checklist

This checklist is the release gate for v1 completion.

## Preconditions

- `DATABASE_URL` points to a reachable Postgres instance.
- `POLYGON_API_KEY` is set and valid.
- Migrations are applied.

## Local Acceptance Command

Run the full v1 gate locally:

```bash
npm run test:acceptance:v1
```

This command runs:
- lint
- production build
- integration tests
- live Polygon integration test
- e2e tests

## Manual Product Checks

After automated checks pass, verify key UX flows manually:

1. Open `/overview`, confirm totals, holdings, classifications render.
2. Toggle raw/look-through mode and verify look-through coverage + staleness panel behavior.
3. Open Metric Audit drawer, switch multiple metrics, confirm contributors load.
4. Open `/valuations`, run `Refresh Prices + Recompute`, and confirm:
   - status updates
   - recent refresh jobs table updates
   - running job polling settles after completion.

## Scheduled Refresh Operational Checks

1. Trigger `/api/valuations/refresh/scheduled` with correct `x-cron-secret`.
2. Verify `/api/valuations/refresh/jobs` records the run with expected status.
3. Verify `/api/valuations/refresh/alerts?lookbackHours=24` returns expected warning signals when failures are injected.

## CI Acceptance Gate

- Use GitHub Actions workflow: `.github/workflows/v1-acceptance-live.yml`
- Trigger manually via `workflow_dispatch`.
- Workflow requires repository secret `POLYGON_API_KEY`.

## Definition of Pass

v1 is accepted when:
- `npm run test:acceptance:v1` passes locally, and
- `V1 Acceptance (Live Polygon)` workflow passes in GitHub Actions, and
- manual product checks above are completed without blocking issues.
