import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "True Portfolio" })).toBeVisible();
  await expect(page.getByText("Trust-first portfolio analytics.")).toBeVisible();
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
