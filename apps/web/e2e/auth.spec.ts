import { test, expect } from "@playwright/test";

test("redirects an unauthenticated visitor from /dashboard to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("signup then login reaches the dashboard shell", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/signup");
  await page.getByPlaceholder("Organization name").fill("E2E Dorms");
  await page.getByPlaceholder("Your name").fill("E2E Owner");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill("password12345");
  await page.getByRole("button", { name: "Log in" }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
