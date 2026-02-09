import { expect, test } from "@playwright/test";

function suffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

test("accounts page creates account and validates empty input", async ({ page }) => {
  await page.goto("/accounts");
  await page.getByTestId("create-account-btn").click();
  await expect(page.getByText("Account name is required.")).toBeVisible();

  const name = `E2E Account ${suffix()}`;
  await page.getByTestId("account-name-input").fill(name);
  await page.getByTestId("create-account-btn").click();

  await expect(page.getByTestId("accounts-table")).toContainText(name);
});

test("transactions page creates instrument, validates trade fields, and creates transaction", async ({
  page,
  request,
}) => {
  const accountName = `E2E Tx Account ${suffix()}`;
  const accountResponse = await request.post("/api/accounts", {
    data: { name: accountName, baseCurrency: "USD" },
  });
  expect(accountResponse.ok()).toBeTruthy();

  await page.goto("/transactions");

  const symbol = `E2E${Math.floor(Math.random() * 99999)}`;
  await page.getByTestId("instrument-symbol-input").fill(symbol);
  await page.getByTestId("instrument-name-input").fill(`Instrument ${symbol}`);
  await page.getByTestId("instrument-kind-select").selectOption("STOCK");
  await page.getByTestId("create-instrument-btn").click();

  await expect
    .poll(async () => page.locator("[data-testid='tx-account-select'] option").allTextContents())
    .toContain(accountName);
  await page.getByTestId("tx-account-select").selectOption({ label: accountName });
  await page.getByTestId("tx-type-select").selectOption("BUY");
  await page.getByTestId("tx-quantity-input").fill("2");
  await page.getByTestId("tx-price-input").fill("101");
  await page.getByTestId("create-tx-btn").click();
  await expect(page.getByText("Instrument is required for BUY/SELL.")).toBeVisible();

  await page.getByTestId("tx-instrument-select").selectOption({ label: `${symbol} (STOCK)` });
  await page.getByTestId("tx-trade-date-input").fill("2026-01-10");
  await page.getByTestId("create-tx-btn").click();

  await expect(page.getByTestId("transactions-table")).toContainText(accountName);
  await expect(page.getByTestId("transactions-table")).toContainText(symbol);
  await expect(page.getByTestId("transactions-table")).toContainText("BUY");
});

test("valuations page recomputes and lists persisted daily valuations", async ({ page, request }) => {
  const accountName = `E2E Val Account ${suffix()}`;
  const accountRes = await request.post("/api/accounts", {
    data: { name: accountName, baseCurrency: "USD" },
  });
  expect(accountRes.ok()).toBeTruthy();
  const accountPayload = (await accountRes.json()) as { data: { id: string } };
  const accountId = accountPayload.data.id;

  await request.post("/api/transactions", {
    data: {
      accountId,
      type: "DEPOSIT",
      tradeDate: "2026-01-10",
      amount: 100,
      feeAmount: 0,
    },
  });

  await page.goto("/valuations");
  await page.getByTestId("valuation-account-select").selectOption({ label: accountName });
  await page.getByTestId("valuation-from-input").fill("2026-01-10");
  await page.getByTestId("valuation-to-input").fill("2026-01-10");
  await page.getByTestId("recompute-valuations-btn").click();

  await expect(page.getByTestId("valuation-last-result")).toContainText("2026-01-10 to 2026-01-10");
  await expect(page.getByRole("heading", { name: "Valuation Series" })).toBeVisible();
  await expect(page.getByTestId("valuations-table")).toContainText(accountId);
});
