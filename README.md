## True Portfolio

Trust-first portfolio analytics web app.

### Stack
- Next.js + TypeScript
- Prisma ORM
- Postgres (Docker)

### Local Setup

1. Install dependencies:
```bash
npm install
```

2. Copy env file:
```bash
cp .env.example .env
```

3. Start Postgres:
```bash
npm run db:up
```

4. Run initial migration:
```bash
npm run prisma:migrate -- --name init
```

5. Seed realistic demo data:
```bash
npm run db:seed
```

6. Start app:
```bash
npm run dev
```

App URL: [http://localhost:3000](http://localhost:3000)

### Prisma Commands

```bash
npm run prisma:generate
npm run prisma:studio
npm run db:seed
```

### Daily Valuation Materialization

Recompute and persist daily valuation rows:
```bash
curl -X POST http://localhost:3000/api/valuations \
  -H "content-type: application/json" \
  -d '{"from":"2026-01-01","to":"2026-01-31"}'
```

List persisted valuation rows:
```bash
curl "http://localhost:3000/api/valuations?from=2026-01-01&to=2026-01-31"
```

Run full pipeline (refresh prices + recompute valuations):
```bash
curl -X POST http://localhost:3000/api/valuations/refresh \
  -H "content-type: application/json" \
  -d '{"from":"2026-01-01","to":"2026-01-31"}'
```

### Curated ETF Constituent Ingestion

Ingest curated ETF look-through rows (manual dataset path):
```bash
curl -X POST http://localhost:3000/api/etf-constituents/ingest \
  -H "content-type: application/json" \
  -d '{
    "asOfDate":"2026-01-31",
    "source":"curated_manual",
    "replaceExistingAsOfDate":true,
    "rows":[
      {"etfSymbol":"SPY","constituentSymbol":"AAPL","weight":0.08},
      {"etfSymbol":"SPY","constituentSymbol":"MSFT","weight":0.07}
    ]
  }'
```

### Testing

Run unit + integration tests with coverage:
```bash
npm run test:coverage
```

Run end-to-end tests:
```bash
npm run test:e2e
```

Run the full local suite:
```bash
npm run test:all
```

### Planning Docs

- `/Users/gan/Documents/true-portfolio/design_docs/design_v0.md`
- `/Users/gan/Documents/true-portfolio/design_docs/implementation_plan_v1.md`
