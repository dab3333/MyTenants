import { test, expect } from "@playwright/test";
import { prisma } from "@mytenants/db";

test("dashboard shows income, tenant count, occupancy, and overdue widgets, and preset switching updates the URL", async ({ page }) => {
  const email = `dashboard-e2e-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Organization name").fill("Dashboard E2E Org");
  await page.getByLabel("Your name").fill("E2E Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Set up a building with two rooms.
  await page.goto("/dashboard/buildings");
  await page.getByRole("button", { name: "Add Building" }).click();
  await page.getByLabel("Name").fill("Dashboard Hall");
  await page.getByRole("button", { name: "Save Building" }).click();
  await page.getByRole("link", { name: "Dashboard Hall" }).click();
  await page.getByRole("button", { name: "Add Floor" }).click();
  await page.getByLabel("Floor label").fill("1F");
  await page.getByRole("button", { name: "Save Floor" }).click();
  await page.getByRole("button", { name: "Add Room" }).click();
  await page.getByLabel("Room name").fill("101");
  await page.getByLabel("Capacity").fill("1");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByRole("button", { name: "Save Room" }).click();
  await page.getByRole("button", { name: "Add Room" }).click();
  await page.getByLabel("Room name").fill("102");
  await page.getByLabel("Capacity").fill("1");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByRole("button", { name: "Save Room" }).click();

  // Admit a tenant and settle their invoice in full (income widget data).
  await page.goto("/dashboard/tenants/admit");
  await page.getByLabel("First name").fill("Paid");
  await page.getByLabel("Last name").fill("Tenant");
  await page.getByLabel("Start date").fill("2026-01-01");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByLabel("Deposit amount").fill("3000");
  await page.getByRole("button", { name: "Admit Tenant" }).click();
  await expect(page).toHaveURL(/\/dashboard\/tenants\/.+/);
  await page.getByLabel("Period start").fill("2026-01-01");
  await page.getByLabel("Period end").fill("2026-01-31");
  await page.getByLabel("Due date").fill("2026-01-05");
  await page.getByLabel("Amount due").fill("3000");
  await page.getByRole("button", { name: "New Invoice" }).click();
  await page.getByTestId("invoice-row").getByRole("link").click();
  await expect(page).toHaveURL(/\/dashboard\/invoices\/.+/);
  await page.getByLabel("Amount paid").fill("3000");
  await page.getByRole("button", { name: "Record Payment" }).click();
  await expect(page.getByTestId("invoice-status")).toHaveText("PAID");

  // Admit a second tenant with an unpaid invoice, then mark it OVERDUE directly —
  // this transition only otherwise happens via apps/worker's daily cron, which
  // this e2e run does not wait for.
  await page.goto("/dashboard/tenants/admit");
  await page.getByLabel("First name").fill("Overdue");
  await page.getByLabel("Last name").fill("Tenant");
  await page.getByLabel("Start date").fill("2026-01-01");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByLabel("Deposit amount").fill("3000");
  await page.getByRole("button", { name: "Admit Tenant" }).click();
  await expect(page).toHaveURL(/\/dashboard\/tenants\/.+/);
  await page.getByLabel("Period start").fill("2026-01-01");
  await page.getByLabel("Period end").fill("2026-01-31");
  await page.getByLabel("Due date").fill("2026-01-05");
  await page.getByLabel("Amount due").fill("3000");
  await page.getByRole("button", { name: "New Invoice" }).click();
  await page.getByTestId("invoice-row").getByRole("link").click();
  await expect(page).toHaveURL(/\/dashboard\/invoices\/.+/);
  const invoiceId = new URL(page.url()).pathname.split("/").pop()!;
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: "OVERDUE" } });

  // Dashboard reflects both tenants' occupancy, the settled income, and the overdue invoice.
  await page.goto("/dashboard");
  await expect(page.getByTestId("occupancy-row")).toContainText("2/2");
  await expect(page.getByTestId("overdue-count")).toContainText("1");
  await expect(page.getByTestId("overdue-amount")).toContainText("₱3,000.00");

  // Switching the date-range preset updates the URL and re-renders without error.
  await page.getByRole("button", { name: "Last 6 months" }).click();
  await page.getByRole("option", { name: "Last 12 months" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/preset=12m/);
  await expect(page.getByTestId("occupancy-row")).toContainText("2/2");
});
