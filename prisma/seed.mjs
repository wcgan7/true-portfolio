import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required for seeding");
}

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function truncateAll() {
  const tables = [
    '"WarningEvent"',
    '"DailyValuation"',
    '"EtfConstituent"',
    '"PricePoint"',
    '"Transaction"',
    '"Instrument"',
    '"Account"',
  ];

  for (const table of tables) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${table} CASCADE;`);
  }
}

async function seed() {
  await truncateAll();

  const [taxable, retirement] = await Promise.all([
    prisma.account.create({
      data: {
        name: "Brokerage",
        baseCurrency: "USD",
      },
    }),
    prisma.account.create({
      data: {
        name: "Retirement",
        baseCurrency: "USD",
      },
    }),
  ]);

  const instruments = await Promise.all([
    prisma.instrument.create({
      data: {
        symbol: "AAPL",
        name: "Apple Inc.",
        kind: "STOCK",
        currency: "USD",
        metadataJson: {
          country: "United States",
          sector: "Technology",
          industry: "Consumer Electronics",
        },
      },
    }),
    prisma.instrument.create({
      data: {
        symbol: "MSFT",
        name: "Microsoft Corporation",
        kind: "STOCK",
        currency: "USD",
        metadataJson: {
          country: "United States",
          sector: "Technology",
          industry: "Software",
        },
      },
    }),
    prisma.instrument.create({
      data: {
        symbol: "SPY",
        name: "SPDR S&P 500 ETF Trust",
        kind: "ETF",
        currency: "USD",
        metadataJson: {
          country: "United States",
          sector: "Broad Market",
          industry: "Index ETF",
        },
      },
    }),
    prisma.instrument.create({
      data: {
        symbol: "QQQ",
        name: "Invesco QQQ Trust",
        kind: "ETF",
        currency: "USD",
        metadataJson: {
          country: "United States",
          sector: "Technology",
          industry: "Index ETF",
        },
      },
    }),
  ]);

  const bySymbol = new Map(instruments.map((instrument) => [instrument.symbol, instrument]));

  await prisma.transaction.createMany({
    data: [
      {
        accountId: taxable.id,
        type: "DEPOSIT",
        tradeDate: new Date("2026-01-02"),
        amount: 50000,
        feeAmount: 0,
      },
      {
        accountId: taxable.id,
        instrumentId: bySymbol.get("AAPL").id,
        type: "BUY",
        tradeDate: new Date("2026-01-03"),
        quantity: 60,
        price: 190,
        amount: 11400,
        feeAmount: 0,
      },
      {
        accountId: taxable.id,
        instrumentId: bySymbol.get("SPY").id,
        type: "BUY",
        tradeDate: new Date("2026-01-03"),
        quantity: 50,
        price: 620,
        amount: 31000,
        feeAmount: 0,
      },
      {
        accountId: taxable.id,
        instrumentId: bySymbol.get("AAPL").id,
        type: "SELL",
        tradeDate: new Date("2026-01-17"),
        quantity: 10,
        price: 198,
        amount: 1980,
        feeAmount: 0,
      },
      {
        accountId: taxable.id,
        instrumentId: bySymbol.get("AAPL").id,
        type: "DIVIDEND",
        tradeDate: new Date("2026-01-20"),
        amount: 65,
        feeAmount: 0,
      },
      {
        accountId: taxable.id,
        type: "FEE",
        tradeDate: new Date("2026-01-31"),
        amount: 25,
        feeAmount: 0,
      },
      {
        accountId: retirement.id,
        type: "DEPOSIT",
        tradeDate: new Date("2026-01-05"),
        amount: 20000,
        feeAmount: 0,
      },
      {
        accountId: retirement.id,
        instrumentId: bySymbol.get("QQQ").id,
        type: "BUY",
        tradeDate: new Date("2026-01-06"),
        quantity: 40,
        price: 500,
        amount: 20000,
        feeAmount: 0,
      },
      {
        accountId: retirement.id,
        instrumentId: bySymbol.get("MSFT").id,
        type: "BUY",
        tradeDate: new Date("2026-01-21"),
        quantity: 8,
        price: 430,
        amount: 3440,
        feeAmount: 0,
      },
      {
        accountId: retirement.id,
        type: "DEPOSIT",
        tradeDate: new Date("2026-01-21"),
        amount: 4000,
        feeAmount: 0,
      },
    ],
  });

  const priceRows = [];
  const dailyCloses = {
    AAPL: [190, 191, 193, 195, 194, 196, 198],
    MSFT: [425, 427, 429, 431, 432, 434, 436],
    SPY: [620, 622, 624, 626, 625, 627, 629],
    QQQ: [500, 502, 504, 506, 505, 507, 509],
  };
  const days = ["2026-01-03", "2026-01-10", "2026-01-17", "2026-01-24", "2026-01-28", "2026-01-30", "2026-01-31"];

  for (const [symbol, closes] of Object.entries(dailyCloses)) {
    const instrumentId = bySymbol.get(symbol).id;
    closes.forEach((close, idx) => {
      priceRows.push({
        instrumentId,
        date: new Date(days[idx]),
        close,
        source: "seed",
      });
    });
  }

  await prisma.pricePoint.createMany({ data: priceRows });

  await prisma.etfConstituent.createMany({
    data: [
      {
        etfInstrumentId: bySymbol.get("SPY").id,
        constituentSymbol: "AAPL",
        weight: 0.08,
        asOfDate: new Date("2026-01-31"),
        source: "seed",
      },
      {
        etfInstrumentId: bySymbol.get("SPY").id,
        constituentSymbol: "MSFT",
        weight: 0.07,
        asOfDate: new Date("2026-01-31"),
        source: "seed",
      },
      {
        etfInstrumentId: bySymbol.get("SPY").id,
        constituentSymbol: "NVDA",
        weight: 0.06,
        asOfDate: new Date("2026-01-31"),
        source: "seed",
      },
      {
        etfInstrumentId: bySymbol.get("QQQ").id,
        constituentSymbol: "MSFT",
        weight: 0.09,
        asOfDate: new Date("2026-01-31"),
        source: "seed",
      },
      {
        etfInstrumentId: bySymbol.get("QQQ").id,
        constituentSymbol: "AAPL",
        weight: 0.08,
        asOfDate: new Date("2026-01-31"),
        source: "seed",
      },
      {
        etfInstrumentId: bySymbol.get("QQQ").id,
        constituentSymbol: "AMZN",
        weight: 0.06,
        asOfDate: new Date("2026-01-31"),
        source: "seed",
      },
    ],
  });

  console.log("Seed complete: accounts, instruments, transactions, prices, and ETF constituents created.");
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
