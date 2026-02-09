-- CreateEnum
CREATE TYPE "InstrumentKind" AS ENUM ('CASH', 'STOCK', 'ETF', 'OPTION', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'FEE', 'DEPOSIT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "WarningSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instrument" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "InstrumentKind" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "metadataJson" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "instrumentId" TEXT,
    "type" "TransactionType" NOT NULL,
    "tradeDate" TIMESTAMP(3) NOT NULL,
    "settleDate" TIMESTAMP(3),
    "quantity" DECIMAL(20,6),
    "price" DECIMAL(20,6),
    "amount" DECIMAL(20,6) NOT NULL,
    "feeAmount" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricePoint" (
    "id" TEXT NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "close" DECIMAL(20,6) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'polygon',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtfConstituent" (
    "id" TEXT NOT NULL,
    "etfInstrumentId" TEXT NOT NULL,
    "constituentSymbol" TEXT NOT NULL,
    "weight" DECIMAL(10,8) NOT NULL,
    "asOfDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EtfConstituent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyValuation" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "accountId" TEXT,
    "cashValue" DECIMAL(20,6) NOT NULL,
    "marketValue" DECIMAL(20,6) NOT NULL,
    "totalValue" DECIMAL(20,6) NOT NULL,
    "completenessFlag" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyValuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarningEvent" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "code" TEXT NOT NULL,
    "severity" "WarningSeverity" NOT NULL DEFAULT 'WARNING',
    "accountId" TEXT,
    "instrumentId" TEXT,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Instrument_symbol_kind_key" ON "Instrument"("symbol", "kind");

-- CreateIndex
CREATE INDEX "Transaction_accountId_tradeDate_idx" ON "Transaction"("accountId", "tradeDate");

-- CreateIndex
CREATE INDEX "Transaction_instrumentId_tradeDate_idx" ON "Transaction"("instrumentId", "tradeDate");

-- CreateIndex
CREATE INDEX "PricePoint_date_idx" ON "PricePoint"("date");

-- CreateIndex
CREATE UNIQUE INDEX "PricePoint_instrumentId_date_source_key" ON "PricePoint"("instrumentId", "date", "source");

-- CreateIndex
CREATE INDEX "EtfConstituent_etfInstrumentId_asOfDate_idx" ON "EtfConstituent"("etfInstrumentId", "asOfDate");

-- CreateIndex
CREATE INDEX "EtfConstituent_constituentSymbol_idx" ON "EtfConstituent"("constituentSymbol");

-- CreateIndex
CREATE INDEX "DailyValuation_date_idx" ON "DailyValuation"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyValuation_date_accountId_key" ON "DailyValuation"("date", "accountId");

-- CreateIndex
CREATE INDEX "WarningEvent_date_idx" ON "WarningEvent"("date");

-- CreateIndex
CREATE INDEX "WarningEvent_code_idx" ON "WarningEvent"("code");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PricePoint" ADD CONSTRAINT "PricePoint_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EtfConstituent" ADD CONSTRAINT "EtfConstituent_etfInstrumentId_fkey" FOREIGN KEY ("etfInstrumentId") REFERENCES "Instrument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyValuation" ADD CONSTRAINT "DailyValuation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarningEvent" ADD CONSTRAINT "WarningEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarningEvent" ADD CONSTRAINT "WarningEvent_instrumentId_fkey" FOREIGN KEY ("instrumentId") REFERENCES "Instrument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
