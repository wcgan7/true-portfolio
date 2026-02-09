import "dotenv/config";

import { beforeAll, beforeEach } from "vitest";

import { prisma } from "@/src/lib/db";

const TABLES = [
  '"RefreshJob"',
  '"WarningEvent"',
  '"DailyValuation"',
  '"EtfConstituent"',
  '"PricePoint"',
  '"Transaction"',
  '"Instrument"',
  '"Account"',
];

beforeAll(() => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set for tests");
  }
});

beforeEach(async () => {
  await prisma.$transaction(
    TABLES.map((table) => prisma.$executeRawUnsafe(`TRUNCATE TABLE ${table} CASCADE;`)),
  );
});
