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

## Repo Review Gap Tracker (as of 2026-02-10)

This section tracks remaining work found during a repo review against
`/Users/gan/Documents/true-portfolio/design_docs/implementation_plan_v1.md`.

### Summary

- Total planned scope assessed: 100%
- Estimated complete: 100%
- Remaining prioritized gaps: 0

### Priority Key

- `P1`: blocks v1 plan conformance and should be closed before v1 sign-off
- `P2`: important quality/architecture alignment items
- `P3`: operational completion item

### Gap Register

| ID | Priority | Gap | Current Status | Owner | Exit Criterion |
| --- | --- | --- | --- | --- | --- |
| GAP-001 | P1 | `/transactions` lacks editable table and date filtering | Complete (local verified, 2026-02-09) | Unassigned | User can edit existing transactions from UI and filter by account + date range |
| GAP-002 | P1 | `/overview` UI lacks period controls (since inception / YTD / custom) | Complete (local verified, 2026-02-09) | Unassigned | UI exposes period selector and date inputs; metrics reflect selected period |
| GAP-003 | P2 | Query validation not consistently zod-based on API boundary | Complete (local verified, 2026-02-09) | Unassigned | Query parsing for `overview`, `audit`, and valuation refresh list/alert endpoints uses zod schemas |
| GAP-004 | P2 | Engine extraction seam interfaces not implemented | Complete (local verified, 2026-02-09) | Unassigned | `PerformanceEngine`, `ValuationEngine`, and `ExposureEngine` interfaces exist and API consumes abstractions |
| GAP-005 | P2 | Unit tests do not cover full planned fixture set | Complete (local verified, 2026-02-10) | Unassigned | Unit tests include MWR/TWR fixtures and ETF flattening/fallback fixture coverage |
| GAP-006 | P3 | Live acceptance gate blocked by missing `POLYGON_API_KEY` in local env | Complete (local verified, 2026-02-10) | Unassigned | `npm run test:acceptance:v1` passes locally with live Polygon test enabled |

### Owner-Ready Task Breakdown

#### GAP-001: Transactions editability + date filtering (`P1`)

- Implement UI edit flow on `/transactions`:
  - add row-level edit action and inline or modal edit form
  - submit edits to `PATCH /api/transactions/:id`
  - refresh table and preserve active filters
- Extend transaction listing filter:
  - add `from` and `to` query params to `GET /api/transactions`
  - wire date filter controls in UI
- Add tests:
  - integration tests for date filtering on `GET /api/transactions`
  - e2e test for editing an existing transaction and seeing updated values

Acceptance checks:
- User can edit quantity/price/amount/notes on an existing transaction.
- Account and date-range filtering are both supported in the transactions table.
- Validation errors render clear 4xx messages in UI.

#### GAP-002: Overview period controls (`P1`)

- Add period controls in `/overview`:
  - selector for `since_inception`, `ytd`, `custom`
  - custom `from`/`to` fields when `custom` is selected
  - persist selection in URL query params
- Pass `period`, `from`, and `to` through server page call to `getOverviewSnapshot`.
- Add tests:
  - e2e test for switching period and observing KPI update
  - integration/API tests for invalid custom range handling remain green

Acceptance checks:
- User can switch period modes from UI.
- Custom period requires valid `from` and `to`.
- MWR/TWR and related KPI outputs change consistently with selected period.

#### GAP-003: Consistent zod API query validation (`P2`)

- Create zod query schemas for:
  - `/api/overview`
  - `/api/audit/metric`
  - `/api/valuations/refresh/jobs`
  - `/api/valuations/refresh/alerts`
- Replace manual parsing branches with schema parsing + normalized outputs.
- Keep current error shape (`400` with clear validation message).

Acceptance checks:
- Invalid query params consistently return structured 400 validation errors.
- Query parsing logic is centralized and easier to test.

#### GAP-004: Engine extraction seam interfaces (`P2`)

- Introduce interface types:
  - `PerformanceEngine`
  - `ValuationEngine`
  - `ExposureEngine`
- Create concrete TS implementations that satisfy interfaces.
- Update API/service composition to depend on interfaces, not direct concrete imports.
- Add contract-level tests for interface implementations.

Acceptance checks:
- API layer composes via interfaces.
- Swapping implementation behind interfaces does not change API contract or tests.

#### GAP-005: Planned unit test parity (`P2`)

- Add unit fixtures/tests for:
  - MWR reference fixtures
  - TWR daily chaining fixtures
  - missing price fallback + warning behavior
  - ETF flattening aggregation + uncovered bucket behavior
- Keep integration coverage as-is; these tests should validate pure compute/service logic quickly.

Acceptance checks:
- Unit test suite explicitly covers all unit bullets from implementation plan.
- Coverage report shows corresponding functions exercised at unit level.

#### GAP-006: Local live acceptance completion (`P3`)

- Set local `POLYGON_API_KEY` in environment.
- Re-run:
  - `npm run test:acceptance:v1`
- Record result and timestamp in this checklist once passing.

Acceptance checks:
- Full acceptance command passes locally without skipping live Polygon test.
- CI workflow `V1 Acceptance (Live Polygon)` passes with repository secret configured.

### Progress Tracking

Use this quick tracker during execution:

- [x] GAP-001 complete
- [x] GAP-002 complete
- [x] GAP-003 complete
- [x] GAP-004 complete
- [x] GAP-005 complete
- [x] GAP-006 complete

### Verification Notes

- 2026-02-09 local verification run:
  - `npm run lint` ✅
  - `npm run build` ✅
  - `npm run test:integration` ✅
  - `npm run test:e2e` ✅
- 2026-02-09 local verification run (GAP-003):
  - `npm run build` ✅
  - `npm run test:integration` ✅
  - `npm run test:e2e` ✅
- 2026-02-09 local verification run (GAP-004):
  - `npm run build` ✅
  - `npm run test:unit` ✅
  - `npm run test:integration` ✅
  - `npm run test:e2e` ✅
- 2026-02-10 local verification run (GAP-004 seam swap coverage):
  - Added unit test validating `getOverviewSnapshot` with injected stub `PortfolioEngines` implementation
  - `npm run test:unit` ✅
  - `npm run test:integration` ✅
  - `npm run build` ✅
- 2026-02-10 local verification run (GAP-005 fixture parity):
  - Added unit fixtures for `MWR` reference, `TWR` daily chaining, valuation missing-price fallback/warnings, and ETF flattening uncovered bucket behavior
  - `npm run test:unit` ✅
  - `npm run test:integration` ✅
  - `npm run build` ✅
  - `npm run test:coverage` ✅
- 2026-02-10 local verification run (GAP-006):
  - `npm run test:integration:polygon:required` ❌ (`POLYGON_API_KEY is required`)
  - Local env files checked: `.env` has no `POLYGON_API_KEY`; `.env.local` and `.env.test` missing
- 2026-02-10 local verification run (GAP-006 completion):
  - `source ~/.zshrc && npm run test:acceptance:v1` ✅
  - Includes passing live Polygon test (`npm run test:integration:polygon`)
