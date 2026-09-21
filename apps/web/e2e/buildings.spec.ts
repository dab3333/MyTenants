import { test, expect } from "@playwright/test";

test("create a building, add a floor and a room, and see it vacant in the overview grid", async ({ page }) => {
  const email = `buildings-e2e-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByPlaceholder("Organization name").fill("Buildings E2E Org");
  await page.getByPlaceholder("Your name").fill("E2E Owner");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.goto("/dashboard/buildings");
  await page.getByRole("button", { name: "Add Building" }).click();
  await page.getByLabel("Name").fill("Sunrise Hall");
  await page.getByRole("button", { name: "Save Building" }).click();
  await expect(page.getByRole("link", { name: "Sunrise Hall" })).toBeVisible();

  await page.getByRole("link", { name: "Sunrise Hall" }).click();
  await expect(page.getByRole("heading", { name: "Sunrise Hall" })).toBeVisible();

  await page.getByRole("button", { name: "Add Floor" }).click();
  await page.getByLabel("Floor label").fill("1F");
  await page.getByRole("button", { name: "Save Floor" }).click();
  await expect(page.getByRole("heading", { name: "1F" })).toBeVisible();

  await page.getByRole("button", { name: "Add Room" }).click();
  await page.getByLabel("Room name").fill("101");
  await page.getByLabel("Capacity").fill("2");
  await page.getByLabel("Monthly rate").fill("3000");
  await page.getByRole("button", { name: "Save Room" }).click();

  const roomCard = page.getByTestId("room-card");
  await expect(roomCard).toBeVisible();
  await expect(roomCard).toHaveAttribute("data-status", "vacant");
  await expect(roomCard).toContainText("0/2");
});
