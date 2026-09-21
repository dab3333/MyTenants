import { test, expect } from "@playwright/test";

test("admit a new tenant into a room, see occupancy update, then end the tenancy and see it freed", async ({ page }) => {
  const email = `tenant-admission-e2e-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByPlaceholder("Organization name").fill("Tenant Admission E2E Org");
  await page.getByPlaceholder("Your name").fill("E2E Owner");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Set up a building/floor/room to admit into.
  await page.goto("/dashboard/buildings");
  await page.getByRole("button", { name: "Add Building" }).click();
  await page.getByLabel("Name").fill("Admission Hall");
  await page.getByRole("button", { name: "Save Building" }).click();
  await page.getByRole("link", { name: "Admission Hall" }).click();
  await page.getByRole("button", { name: "Add Floor" }).click();
  await page.getByLabel("Floor label").fill("1F");
  await page.getByRole("button", { name: "Save Floor" }).click();
  await page.getByRole("button", { name: "Add Room" }).click();
  await page.getByLabel("Room name").fill("101");
  await page.getByLabel("Capacity").fill("1");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByRole("button", { name: "Save Room" }).click();
  await expect(page.getByTestId("room-card")).toContainText("0/1");

  // Admit a new tenant into that room.
  await page.goto("/dashboard/tenants/admit");
  await page.getByLabel("First name").fill("Jane");
  await page.getByLabel("Last name").fill("Doe");
  await page.getByLabel("Start date").fill("2026-01-01");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByLabel("Deposit amount").fill("3000");
  await page.getByRole("button", { name: "Admit Tenant" }).click();
  await expect(page).toHaveURL(/\/dashboard\/tenants\/.+/);
  await expect(page.getByRole("heading", { name: "Jane Doe" })).toBeVisible();

  // The room in the buildings grid should now show 1/1 (full).
  await page.goto("/dashboard/buildings");
  await page.getByRole("link", { name: "Admission Hall" }).click();
  const roomCard = page.getByTestId("room-card");
  await expect(roomCard).toContainText("1/1");
  await expect(roomCard).toHaveAttribute("data-status", "full");

  // End the tenancy and confirm the room frees up again.
  await page.goto("/dashboard/tenants");
  await page.getByRole("link", { name: "Jane Doe" }).click();
  await page.getByRole("button", { name: "End Tenancy" }).click();
  await page.locator("dialog").getByRole("button", { name: "End Tenancy" }).click();
  await expect(page.getByText("MOVED_OUT")).toBeVisible();

  await page.goto("/dashboard/buildings");
  await page.getByRole("link", { name: "Admission Hall" }).click();
  await expect(page.getByTestId("room-card")).toContainText("0/1");
});
