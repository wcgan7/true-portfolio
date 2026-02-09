# Implementation Plan v1: Trust-First Portfolio Analytics Web App

## Summary
Build a local-first monolith web app for a solo investor where transaction-driven accounting is the source of truth for holdings, P&L, valuation, and returns.

Core product problem solved:
Most portfolio tools are hard to trust because metrics are not clearly traceable to cashflows and transactions. This app provides deterministic, auditable outputs from an explicit transaction and cash ledger.

Locked decisions:
- User target: solo investor
- App shape: monolith web app
- Frontend: Next.js + TypeScript
- Backend: Next.js route handlers + TypeScript service layer
- Database: Postgres from day one
- ORM/migrations: Prisma
- Charts: Recharts
- Pricing source: Polygon (Massive) Stocks Starter plan
- Pricing trigger: manual refresh button in MVP
- Currency scope: USD-only in MVP
- Instrument model: single `Instrument` table + `kind` enum with extensible metadata
- Cost basis method in v1: FIFO (document future LIFO/average cost support)
- Returns in v1: daily close-based TWR + MWR/IRR; future goal is intraday-aware
- ETF look-through source: curated manual constituent dataset
- Missing prices: use last known close + warning
- ETF look-through gaps: partial flatten + explicit uncovered bucket
- Cash policy: allow negative cash + warning
- MVP screens: Accounts + Transactions + Overview
- Audit depth: metric-level drill-down drawer
- Seed data: include realistic portfolio seed dataset
- MVP acceptance gate: end-to-end demo with live prices

## Scope

### In Scope (MVP)
- Multi-account support for one user
- Transaction types: buy, sell, dividend, fee, deposit, withdrawal
- Derived holdings and cash balances (no manual holdings entry)
- Daily valuation using EOD prices
- Portfolio and account metrics:
  - MWR/IRR
  - TWR (daily chaining)
  - Realized/unrealized P&L
- Periods: since inception, YTD, custom
- Holdings concentration chart (value + %)
- ETF look-through flattening mode
- Classification-ready structure (country/sector/currency fields in schema, with basic exposure views)
- Data quality warnings and metric drill-down

### Out of Scope (MVP)
- Options lifecycle
- Broker statement imports
- Auth/multi-user account management
- Mobile app
- Automated corporate action ingestion
- Tax reporting
- Full multi-currency FX conversion

## Architecture

### High-Level
- Monolith repository
- Next.js App Router for UI and API routes
- TypeScript domain service modules for portfolio engine
- Postgres persistence with Prisma
- Local dev first (Dockerized Postgres)

### Backend Modules
- `ledger-engine`: deterministic replay of transactions into cash + positions
- `valuation-engine`: point-in-time and daily valuation series
- `performance-engine`: MWR/TWR and period filtering
- `exposure-engine`: raw concentration and ETF look-through flattening
- `pricing-service`: Polygon integration, persistence, fallback handling
- `warning-service`: warning generation for integrity/audit UX

### Python Strategy
TS-only backend for v1.
Add explicit extraction seam so compute engines can later be moved to Python without API contract changes.

Use interfaces such as:
- `PerformanceEngine`
- `ValuationEngine`
- `ExposureEngine`

The API layer and UI consume interfaces, not concrete implementations.

## Data Model (Prisma-Oriented)

### `Account`
- `id`
- `name`
- `baseCurrency` (fixed to `USD` in MVP)
- `createdAt`

### `Instrument`
Single-table instrument model.
- `id`
- `symbol`
- `name`
- `kind` enum: `CASH | STOCK | ETF | OPTION | CUSTOM`
- `currency` (default `USD`)
- `metadataJson` (JSON for future subtype-specific fields)
- `isActive`
- `createdAt`

Notes:
- MVP operational kinds: `CASH`, `STOCK`, `ETF`
- `OPTION` and `CUSTOM` are schema-level supported for forward compatibility; option lifecycle logic remains out of MVP scope

### `Transaction`
- `id`
- `accountId`
- `instrumentId` (nullable for pure cash events if needed)
- `type` enum: `BUY | SELL | DIVIDEND | FEE | DEPOSIT | WITHDRAWAL`
- `tradeDate`
- `settleDate` (optional in MVP)
- `quantity` (required for BUY/SELL)
- `price` (required for BUY/SELL)
- `amount` (cash amount field for non-lot events and normalized storage)
- `feeAmount`
- `notes`
- `externalRef` (for future import idempotency)
- `createdAt`

### `PricePoint`
- `id`
- `instrumentId`
- `date`
- `close`
- `source` (`polygon` in MVP)
- `fetchedAt`

### `EtfConstituent`
- `id`
- `etfInstrumentId`
- `constituentSymbol`
- `weight`
- `asOfDate`
- `source`
- `ingestedAt`

### `DailyValuation`
- `id`
- `date`
- `accountId` (nullable for portfolio total rows)
- `cashValue`
- `marketValue`
- `totalValue`
- `completenessFlag`

### `WarningEvent`
- `id`
- `date`
- `code`
- `severity`
- `accountId` (optional)
- `instrumentId` (optional)
- `metadataJson`

## Calculation Rules

### Ledger and Cash
- Holdings are derived strictly from transaction replay
- Cash movement rules:
  - BUY: `-(quantity * price + feeAmount)`
  - SELL: `+(quantity * price - feeAmount)`
  - DIVIDEND: `+amount`
  - FEE: `-amount`
  - DEPOSIT: `+amount`
  - WITHDRAWAL: `-amount`
- Negative cash allowed; create warning event

### P&L
- Realized P&L: FIFO lot matching only in v1
- Unrealized P&L: `marketValue - remainingCostBasis`

### Valuation
- EOD close prices for valuation dates
- If missing on date: use last-known close and emit warning

### Returns
- MWR: IRR over dated external cashflows and terminal value
- TWR: daily chaining (close-based)
- Period options: since inception, YTD, custom

### ETF Look-Through
- For each ETF position, allocate position market value by constituent weights
- Aggregate constituent exposure with direct holdings
- If constituent dataset missing for an ETF, allocate value to uncovered bucket
- Display:
  - look-through coverage %
  - staleness date for constituent dataset

## API Surface (MVP)
- `POST /api/accounts`
- `GET /api/accounts`
- `POST /api/transactions`
- `PATCH /api/transactions/:id`
- `GET /api/transactions`
- `POST /api/prices/refresh`
- `GET /api/overview`
- `GET /api/audit/metric`

Request validation:
- zod schema validation at API boundary
- clear 4xx messages for domain validation failures

## UI Plan

### `/accounts`
- list accounts
- create account

### `/transactions`
- transaction form
- editable transaction table
- account/date filtering

### `/overview`
- KPI cards for total value, P&L, MWR, TWR
- holdings concentration chart
- raw vs look-through toggle
- exposure table/chart with top constituents
- warnings panel
- metric drill-down drawer with contributing transactions/positions

## Data Integrity and Audit UX
- Warnings:
  - missing price data
  - unknown instrument symbol
  - ETF look-through unavailable
  - negative cash
- Drill-down behavior:
  - click metric/chart point
  - show deterministic decomposition and source transactions

## Implementation Sequence

1. Bootstrap and infrastructure
- scaffold Next.js TypeScript app
- add Prisma + Postgres + Docker compose
- setup lint/test/typecheck scripts

2. Schema and migrations
- define Prisma models/enums/indexes
- seed realistic demo dataset

3. Ledger and valuation engines
- implement deterministic transaction replay
- implement daily valuation generation

4. Performance engine
- implement FIFO lot matching
- implement MWR/TWR with period filters

5. Pricing integration
- Polygon client
- manual refresh route and upsert pipeline
- scheduled refresh route + operations runbook (`/Users/gan/Documents/true-portfolio/design_docs/scheduled_refresh_runbook.md`)

6. ETF flattening
- curated constituent ingestion path
- flattening + coverage + staleness outputs

7. UI pages
- accounts page
- transactions page
- overview page + charts + drill-down

8. Hardening
- warning lifecycle
- error and empty states
- consistency checks
- release acceptance gate documented in `/Users/gan/Documents/true-portfolio/design_docs/v1_acceptance_checklist.md`

## Test Plan

### Unit Tests
- cashflow mapping by transaction type
- FIFO lot matching (partial/full sell scenarios)
- MWR reference fixtures
- TWR daily chaining fixtures
- missing price fallback + warning behavior
- ETF flattening aggregation and uncovered bucket

### Integration Tests
- create account -> add transactions -> refresh prices -> fetch overview
- edit historical transaction -> recompute outputs deterministically
- missing constituent data produces partial look-through with explicit coverage
- negative cash remains calculable with warnings

### End-to-End Acceptance Scenario
- load seed dataset
- run Polygon manual refresh
- verify overview metrics/charts render and are coherent
- switch raw/look-through and validate coverage/staleness indicators
- open drill-down and verify traceability to transactions
- run full acceptance command (`npm run test:acceptance:v1`) and pass workflow `.github/workflows/v1-acceptance-live.yml`

## Explicit Future Extensions
- options lifecycle support
- LIFO and average cost basis methods
- intraday-aware return engine
- broker CSV/API imports with idempotency
- auth and multi-user support

## Definition of MVP Done
- A user can manually enter stock/ETF transactions and cash events
- Holdings, cash, valuation, P&L, MWR, and TWR are computed from transactions only
- ETF look-through works for curated ETFs and clearly reports uncovered exposure
- Warnings and drill-down provide auditability
- End-to-end local demo works with live Polygon pricing
