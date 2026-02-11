import "dotenv/config";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { prisma } from "../../src/lib/db";

function suffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "True Portfolio" })).toBeVisible();
  await expect(page.getByText("Trust-first portfolio analytics.")).toBeVisible();
});

test("app shell navigation supports desktop and mobile", async ({ page }) => {
  await page.goto("/overview");
  await expect(page.getByTestId("app-shell-nav")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByTestId("app-shell-mobile-menu-btn").click();
  await expect(page.getByTestId("app-shell-mobile-drawer")).toBeVisible();
  await page.getByRole("link", { name: "Accounts" }).click();
  await expect(page).toHaveURL(/\/accounts$/);
});

test("overview page loads", async ({ page }) => {
  await page.goto("/overview");
  await expect(page.getByRole("heading", { name: "Portfolio Overview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Totals" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data Freshness" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Holdings", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Classifications" })).toBeVisible();
});

test("overview supports look-through mode toggle", async ({ page }) => {
  await page.goto("/overview?mode=lookthrough");
  await expect(page.getByText("Mode:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Look-through Coverage" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Raw Holdings" })).toBeVisible();
});

test("overview shows metric audit panel when metric query is set", async ({ page }) => {
  await page.goto("/overview?metric=totalValue");
  await expect(page.getByRole("heading", { name: "Metric Audit: totalValue" })).toBeVisible();
});

test("overview supports opening and closing audit drawer", async ({ page }) => {
  await page.goto("/overview");
  await page.getByTestId("open-audit-totalValue").click();
  await expect(page.getByTestId("metric-audit-drawer")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Metric Audit: totalValue" })).toBeVisible();
  await page.getByTestId("close-audit-drawer-btn").click();
  await expect(page.getByTestId("metric-audit-drawer")).not.toBeVisible();
});

test("overview supports asset filter links", async ({ page }) => {
  await page.goto("/overview?assetKind=STOCK");
  await expect(page.getByText("Asset Filter:")).toBeVisible();
  await expect(page.getByRole("link", { name: "ETFs" })).toBeVisible();
});

test("overview exposes account filter controls", async ({ page }) => {
  await page.goto("/overview");
  await expect(page.getByText("Account:")).toBeVisible();
  await expect(page.getByRole("link", { name: "All" }).first()).toBeVisible();
});

test("overview renders exposure charts and top-n controls", async ({ page }) => {
  await page.goto("/overview?topN=5");
  await expect(page.getByRole("heading", { name: "Exposure Charts (Top 5)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Holdings Concentration" })).toBeVisible();
  await expect(page.getByRole("link", { name: "20", exact: true })).toBeVisible();
});

test("overview supports period controls including custom range", async ({ page }) => {
  await page.goto("/overview");
  await expect(page.getByTestId("overview-performance-period")).toContainText("since_inception");

  await page.getByRole("link", { name: "YTD" }).click();
  await expect(page.getByTestId("overview-performance-period")).toContainText("ytd");

  await page.getByTestId("overview-custom-from-input").fill("2026-01-01");
  await page.getByTestId("overview-custom-to-input").fill("2026-01-31");
  await page.getByTestId("overview-apply-custom-period-btn").click();
  await expect(page.getByTestId("overview-performance-period")).toContainText("custom");
});

test("overview opens audit drawer from KPI link click", async ({ page }) => {
  await page.goto("/overview");
  await page.getByTestId("kpi-total-value-link").click();
  await expect(page.getByTestId("metric-audit-drawer")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Metric Audit: totalValue" })).toBeVisible();
});

test("overview opens market value audit from chart point click", async ({ page }) => {
  const id = suffix().replace(/[^0-9]/g, "").slice(-8);
  const account = await prisma.account.create({
    data: { name: `E2E Chart Account ${id}`, baseCurrency: "USD" },
  });
  const symbol = `CHRT${id}`;
  const stock = await prisma.instrument.create({
    data: { symbol, name: `Chart ${id}`, kind: "STOCK", currency: "USD" },
  });

  await prisma.transaction.createMany({
    data: [
      {
        accountId: account.id,
        type: "DEPOSIT",
        tradeDate: new Date("2026-01-10T00:00:00.000Z"),
        amount: 200,
        feeAmount: 0,
      },
      {
        accountId: account.id,
        instrumentId: stock.id,
        type: "BUY",
        tradeDate: new Date("2026-01-10T00:00:00.000Z"),
        quantity: 1,
        price: 100,
        amount: 100,
        feeAmount: 0,
      },
    ],
  });
  await prisma.pricePoint.create({
    data: {
      instrumentId: stock.id,
      date: new Date("2026-01-10T00:00:00.000Z"),
      close: 100,
      source: "manual",
    },
  });

  await page.goto(`/overview?asOfDate=2026-01-10&accountId=${account.id}`);
  await page.getByTestId(`chart-point-Holdings-Concentration-${symbol}`).click();
  await expect(page).toHaveURL(new RegExp(`scopeDimension=holding`));
  await expect(page).toHaveURL(new RegExp(`scopeSymbol=${symbol}`));
  await expect(page.getByTestId("metric-audit-drawer")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Metric Audit: marketValue" })).toBeVisible();
  await expect(page.getByTestId("metric-audit-scope")).toContainText(`holding=${symbol}`);
});

test("overview renders flattened look-through rows after mode switch", async ({ page }) => {
  const id = suffix().replace(/[^0-9]/g, "").slice(-8);
  const account = await prisma.account.create({
    data: { name: `E2E LT Account ${id}`, baseCurrency: "USD" },
  });
  const etfSymbol = `LTETF${id}`;
  const directSymbol = `LTAAPL${id}`;
  const constituentSymbol = `LTMSFT${id}`;

  const etf = await prisma.instrument.create({
    data: { symbol: etfSymbol, name: `ETF ${id}`, kind: "ETF", currency: "USD" },
  });
  await prisma.instrument.create({
    data: { symbol: directSymbol, name: `Direct ${id}`, kind: "STOCK", currency: "USD" },
  });
  const direct = await prisma.instrument.findFirstOrThrow({
    where: { symbol: directSymbol, kind: "STOCK" },
    select: { id: true },
  });

  await prisma.transaction.createMany({
    data: [
      {
        accountId: account.id,
        type: "DEPOSIT",
        tradeDate: new Date("2026-01-10T00:00:00.000Z"),
        amount: 150,
        feeAmount: 0,
      },
      {
        accountId: account.id,
        instrumentId: etf.id,
        type: "BUY",
        tradeDate: new Date("2026-01-10T00:00:00.000Z"),
        quantity: 1,
        price: 100,
        amount: 100,
        feeAmount: 0,
      },
      {
        accountId: account.id,
        instrumentId: direct.id,
        type: "BUY",
        tradeDate: new Date("2026-01-10T00:00:00.000Z"),
        quantity: 1,
        price: 50,
        amount: 50,
        feeAmount: 0,
      },
    ],
  });

  await prisma.pricePoint.createMany({
    data: [
      {
        instrumentId: etf.id,
        date: new Date("2026-01-10T00:00:00.000Z"),
        close: 100,
        source: "manual",
      },
      {
        instrumentId: direct.id,
        date: new Date("2026-01-10T00:00:00.000Z"),
        close: 50,
        source: "manual",
      },
    ],
  });

  await prisma.etfConstituent.createMany({
    data: [
      {
        etfInstrumentId: etf.id,
        constituentSymbol: directSymbol,
        weight: 0.5,
        asOfDate: new Date("2026-01-10T00:00:00.000Z"),
        source: "e2e",
      },
      {
        etfInstrumentId: etf.id,
        constituentSymbol,
        weight: 0.4,
        asOfDate: new Date("2026-01-10T00:00:00.000Z"),
        source: "e2e",
      },
    ],
  });

  await page.goto(`/overview?asOfDate=2026-01-10&accountId=${account.id}&mode=raw`);
  await page.getByRole("link", { name: "Look-through" }).click();
  await expect(page.getByText("Mode:")).toContainText("lookthrough");

  await expect(page.getByRole("cell", { name: directSymbol })).toHaveCount(1);
  await expect(page.getByRole("cell", { name: constituentSymbol })).toHaveCount(1);
  await expect(page.getByRole("cell", { name: "UNMAPPED_ETF_EXPOSURE" })).toHaveCount(1);
});

for (const route of ["/overview", "/transactions", "/valuations"]) {
  test(`accessibility baseline has no critical violations on ${route}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(route);
    await expect(page.getByRole("heading").first()).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const critical = results.violations.filter((violation) => violation.impact === "critical");
    expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
  });
}
