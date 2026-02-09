import { expect, test } from "@playwright/test";

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "True Portfolio" })).toBeVisible();
  await expect(page.getByText("Trust-first portfolio analytics.")).toBeVisible();
});

