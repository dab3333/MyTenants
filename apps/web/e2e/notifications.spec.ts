import { test, expect } from "@playwright/test";

test("send an announcement to all tenants and see it in history with delivery status", async ({ page }) => {
  const email = `notifications-e2e-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByLabel("Organization name").fill("Notifications E2E Org");
  await page.getByLabel("Your name").fill("E2E Owner");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Set up a building/floor/room and admit a tenant so there's someone to notify.
  await page.goto("/dashboard/buildings");
  await page.getByRole("button", { name: "Add Building" }).click();
  await page.getByLabel("Name").fill("Notify Hall");
  await page.getByRole("button", { name: "Save Building" }).click();
  await page.getByRole("link", { name: "Notify Hall" }).click();
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
  await page.getByLabel("First name").fill("Ana");
  await page.getByLabel("Last name").fill("Announced");
  await page.getByLabel("Start date").fill("2026-01-01");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByLabel("Deposit amount").fill("3000");
  await page.getByRole("button", { name: "Admit Tenant" }).click();
  await expect(page).toHaveURL(/\/dashboard\/tenants\/.+/);

  // Compose an org-wide announcement. The admitted tenant has no email on file
  // (the admission form doesn't collect one for a brand-new tenant), so this also
  // exercises the missing-email FAILED path end-to-end.
  await page.goto("/dashboard/announcements");
  await page.getByLabel("Subject").fill("Welcome");
  await page.getByLabel("Body").fill("Welcome to the building!");
  await page.getByRole("button", { name: "Send Announcement" }).click();
  await expect(page.getByTestId("notification-row")).toContainText("Welcome");

  // Follow it to the detail page and confirm the tenant was recorded as a recipient.
  await page.getByTestId("notification-row").getByRole("link").click();
  await expect(page).toHaveURL(/\/dashboard\/announcements\/.+/);
  await expect(page.getByTestId("recipient-row")).toContainText("Ana Announced");
  await expect(page.getByTestId("delivery-status")).toHaveText("FAILED");
});
