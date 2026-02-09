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
  await expect(page.getByRole("heading", { name: "Holdings" })).toBeVisible();
});

test("overview supports look-through mode toggle", async ({ page }) => {
  await page.goto("/overview?mode=lookthrough");
  await expect(page.getByText("Mode:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Look-through Coverage" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Raw Holdings" })).toBeVisible();
});
