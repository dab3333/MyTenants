import { test, expect } from "@playwright/test";

test("edit a tenant's profile and filter the tenant list by building and room", async ({ page }) => {
  const email = `tenant-profile-e2e-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByPlaceholder("Organization name").fill("Tenant Profile E2E Org");
  await page.getByPlaceholder("Your name").fill("E2E Owner");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Set up a building with two rooms so the filter has something to distinguish.
  await page.goto("/dashboard/buildings");
  await page.getByRole("button", { name: "Add Building" }).click();
  await page.getByLabel("Name").fill("Profile Hall");
  await page.getByRole("button", { name: "Save Building" }).click();
  await page.getByRole("link", { name: "Profile Hall" }).click();
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

  // Admit a tenant into room 101.
  await page.goto("/dashboard/tenants/admit");
  await page.getByLabel("First name").fill("Original");
  await page.getByLabel("Last name").fill("Name");
  await page.getByLabel("Start date").fill("2026-01-01");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByLabel("Deposit amount").fill("3000");
  await page.getByRole("button", { name: "Admit Tenant" }).click();
  await expect(page).toHaveURL(/\/dashboard\/tenants\/.+/);
  await expect(page.getByRole("heading", { name: "Original Name" })).toBeVisible();

  // Edit the tenant's profile via the modal.
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit Tenant" })).toBeVisible();
  await page.getByLabel("First name").fill("Updated");
  await page.getByLabel("Last name").fill("Tenant");
  await page.getByLabel("Email").fill("updated@example.com");
  await page.getByLabel("Phone", { exact: true }).fill("555-1234");
  await page.getByLabel("Name", { exact: true }).fill("Jane Doe");
  await page.getByLabel("Relationship").fill("Sister");
  await page.getByLabel("Phone number").fill("555-9876");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Tenant updated.")).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveValue("updated@example.com");
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name: "Updated Tenant" })).toBeVisible();

  // The tenants list filters live as selections change, with no Filter button to click.
  await page.goto("/dashboard/tenants");
  await page.getByLabel("Building").selectOption({ label: "Profile Hall" });
  await expect(page).toHaveURL(/buildingId=/);
  await expect(page.getByTestId("tenant-row")).toContainText("Updated Tenant");

  await page.getByLabel("Room").selectOption({ label: "1F / 101" });
  await expect(page).toHaveURL(/roomId=/);
  await expect(page.getByTestId("tenant-row")).toContainText("Updated Tenant");

  // Filtering by the other (empty) room should find nobody.
  await page.getByLabel("Room").selectOption({ label: "1F / 102" });
  await expect(page.getByText("No tenants found.")).toBeVisible();
});
