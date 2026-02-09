## Implementation Plan Reference

The decision-complete v1 implementation plan is documented at:
`/Users/gan/Documents/true-portfolio/design_docs/implementation_plan_v1.md`

Use that file as the execution source of truth for stack, schema, backend APIs, calculation rules, and test/acceptance criteria.

### 0. Core principles

* **Truth engine first**: transactions + cashflows → correct holdings + correct returns
* **Deterministic + auditable**: every metric traceable to inputs
* **Prices are for valuation, not for return math**

---

### A. Data model & portfolio engine

* Accounts (multiple)
* Transactions (buy/sell, fees, dividends, deposits/withdrawals, FX)
* Cash ledger per account
* Holdings derived from transactions (not entered as “current holdings”)

---

### B. Instrument support

* Stocks (long)
* Options (v1: single-leg; open/close/expire/assign/exercise)
* ETFs as instruments (held like stocks)

---

### C. Performance (must be correct)

* Portfolio + account level:

  * MWR/IRR
  * TWR
  * Realized/unrealized P&L
* Periods: since inception, YTD, custom

---

### D. Pricing & valuation

* EOD prices minimum
* Optional live prices later
* Daily portfolio value time series

---

### E. Portfolio overview & analysis (new + expanded)

**Tier 1: Holdings concentration chart**

* Holdings sorted largest → smallest
* Show:

  * market value
  * portfolio %
* Filters:

  * account
  * asset type (stocks/options/etfs/cash)
  * currency

**Tier 1.5: ETF look-through (“flatten”)**

* For any ETF holding, compute a *look-through* view by mapping ETF → constituents.
* Output a “flattened holdings” chart:

  * Aggregate overlapping constituents across ETFs + direct holdings
  * Show top exposures by value and %
* Coverage/UI:

  * show % of portfolio covered by look-through data (some ETFs may be missing)
  * show staleness date of ETF holdings data

**Tier 2: Classification breakdown**

* Breakdown of holdings by:

  * Country
  * Sector / industry
  * Market cap bucket (optional)
  * Currency exposure
* Same views for:

  * raw holdings
  * flattened holdings (look-through)

---

### F. Data integrity / audit

* Warnings:

  * missing prices
  * unknown tickers
  * ETF look-through unavailable for some ETFs
* Drill-down: click a number → see contributing positions/transactions

---

### G. Deprioritized for later (explicit)

* Authentication / multi-user accounts
* Broker statement upload + parsers (IBKR/MooMoo)
* Automated corporate actions ingestion
* Tax reports
* Mobile apps

---

# Phased implementation plan (value-first)

I’ll assume you want a **working web app** with a local DB (SQLite/Postgres) and a simple backend API (or even local-only first). You can adjust later.

## Phase 0 — Define the “truth engine” contract (1–2 days)

**Deliverables**

* Canonical schemas:

  * `Account`
  * `Instrument` (stock/option/etf/cash)
  * `Transaction`
  * `Cashflow` (derived)
  * `PositionLot` (optional)
  * `PricePoint`
* Rules for:

  * how cash changes for each transaction type
  * how holdings are derived

**Why now**: prevents rewrites once options/ETFs arrive.

---

## Phase 1 — Manual entry MVP (80% benefit begins) (1–2 weeks)

**Goal**: You can enter trades manually and trust the output.

**Build**

* Manual transaction entry UI (simple form + table)
* Holdings calculator (stocks + cash)
* Portfolio valuation with EOD prices (can be manual price input initially)
* Portfolio overview chart:

  * holdings by value + %
* Basic realized/unrealized P&L

**Out**

* No options yet
* No returns math yet (or only simple P&L)

---

## Phase 2 — Correct performance metrics (the real moat) (1–2 weeks)

**Build**

* Money-weighted return (IRR) using dated cashflows
* Time-weighted return (daily chaining)
* Period selector (since inception / YTD / custom)
* Audit drill-down: show cashflows used in return calc

**Acceptance tests**

* Your “inject capital + market down” example must compute correctly.

---

## Phase 3 — Options v1 (single-leg + lifecycle) (2–4 weeks)

**Build**

* Options instrument model
* Transactions:

  * STO/BTO/STC/BTC
  * expiry handling
  * assignment/exercise mapping to stock + cash events
* Options views:

  * open options by expiry/underlying
  * premium received/paid
* Ensure performance engine treats premiums and assignments correctly

**Still out**

* Multi-leg spreads as a single object (can be represented as separate legs for now)

---

## Phase 4 — Pricing automation + basic live (optional) (1–2 weeks)

**Build**

* Price ingestion job (EOD first)
* Caching + rate limiting
* Optional “live snapshot” refresh button (not streaming)
* Recompute valuations daily automatically

**Important**

* Returns remain cashflow-based; prices only affect unrealized value.

---

## Phase 5 — ETF look-through “flattening” (2–4 weeks)

**Build**

* ETF holdings data source integration (choose 1 source first)
* Data model:

  * `EtfConstituent(etf, symbol, weight, as_of_date, source)`
* Flattening algorithm:

  * ETF holding value × constituent weight = look-through exposure
  * aggregate with direct holdings
* UI:

  * toggle: **Raw Holdings** vs **Look-through**
  * top exposures chart
  * coverage + staleness indicators

**Edge handling**

* Missing ETF constituents → partial coverage, not silent failure.

---

## Phase 6 — Classification breakdown (country/sector/industry) (2–4 weeks)

**Build**

* Security master metadata for symbols (country/sector/industry)
* Views:

  * pie/bar charts by country, sector, industry
  * both raw + look-through
* Data quality:

  * “unclassified %” shown explicitly

---

## Phase 7 — Quality & corporate actions (later, but stabilizes trust) (ongoing)

**Build**

* Stock splits handling
* Dividend reinvest (optional)
* Symbol changes
* Better reconciliation checks

---

## Phase 8 — Last: auth + broker imports (as you requested) (3–8+ weeks)

**Auth**

* accounts, login, encryption, backups, etc.

**Broker imports**

* IBKR Flex Queries / Activity statements parser
* MooMoo export parser
* Mapping layer with:

  * idempotent imports
  * duplicate detection
  * per-broker quirks
