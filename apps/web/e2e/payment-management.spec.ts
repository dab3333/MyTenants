import { test, expect } from "@playwright/test";

test("create a manual invoice, record a payment, and see it settle as PAID", async ({ page }) => {
  const email = `payment-management-e2e-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByPlaceholder("Organization name").fill("Payment Management E2E Org");
  await page.getByPlaceholder("Your name").fill("E2E Owner");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Set up a building/floor/room and admit a tenant into it.
  await page.goto("/dashboard/buildings");
  await page.getByRole("button", { name: "Add Building" }).click();
  await page.getByLabel("Name").fill("Payment Hall");
  await page.getByRole("button", { name: "Save Building" }).click();
  await page.getByRole("link", { name: "Payment Hall" }).click();
  await page.getByRole("button", { name: "Add Floor" }).click();
  await page.getByLabel("Floor label").fill("1F");
  await page.getByRole("button", { name: "Save Floor" }).click();
  await page.getByRole("button", { name: "Add Room" }).click();
  await page.getByLabel("Room name").fill("101");
  await page.getByLabel("Capacity").fill("1");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByRole("button", { name: "Save Room" }).click();
  await expect(page.getByTestId("room-card")).toContainText("0/1");

  await page.goto("/dashboard/tenants/admit");
  await page.getByLabel("First name").fill("Pat");
  await page.getByLabel("Last name").fill("Payer");
  await page.getByLabel("Start date").fill("2026-01-01");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByLabel("Deposit amount").fill("3000");
  await page.getByRole("button", { name: "Admit Tenant" }).click();
  await expect(page).toHaveURL(/\/dashboard\/tenants\/.+/);

  // Create a manual invoice for this tenancy.
  await page.getByLabel("Period start").fill("2026-01-01");
  await page.getByLabel("Period end").fill("2026-01-31");
  await page.getByLabel("Due date").fill("2026-01-05");
  await page.getByLabel("Amount due").fill("3000");
  await page.getByRole("button", { name: "New Invoice" }).click();
  await expect(page.getByTestId("invoice-row")).toContainText("₱0.00 / ₱3,000.00");

  // Follow it to the invoice detail page and record a full payment.
  await page.getByTestId("invoice-row").getByRole("link").click();
  await expect(page).toHaveURL(/\/dashboard\/invoices\/.+/);
  await page.getByLabel("Amount paid").fill("3000");
  await page.getByRole("button", { name: "Record Payment" }).click();
  await expect(page.getByTestId("invoice-status")).toHaveText("PAID");

  // The org-wide payments view should reflect the settled invoice.
  await page.goto("/dashboard/payments?status=PAID");
  await expect(page.getByTestId("invoice-row")).toContainText("Pat Payer");
});
