import { expect, test } from "@playwright/test";

import { ADMIN, signIn } from "./helpers";

test.describe("who can see the workspace", () => {
  test("an anonymous visitor is sent to the login page", async ({ page }) => {
    await page.goto("/matters");
    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByRole("heading", { name: "Harlow & Vance" }),
    ).toBeVisible();
  });

  test("no matter data reaches an anonymous visitor", async ({ page }) => {
    await page.goto("/clients");
    await expect(page.getByText("Ana Berisha")).toHaveCount(0);
  });

  test("a wrong password does not say which half was wrong", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(ADMIN.email);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    // Next renders its own empty role="alert" announcer, so match the text.
    await expect(
      page.getByText("That email address and password do not match."),
    ).toBeVisible();
  });

  test("the Admin signs in, lands on the dashboard and signs out", async ({
    page,
  }) => {
    await signIn(page);
    await expect(
      page.getByRole("complementary").getByText("Elena Vance", { exact: true }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
