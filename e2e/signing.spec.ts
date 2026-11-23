import { expect, test } from "@playwright/test";

import { drawSignature, latestLink, signIn } from "./helpers";

/**
 * The flow the whole brief is built around: the firm sends a document, the
 * client opens the link and signs, and the firm sees it come back.
 *
 * It writes to the database, so run `npm run db:reset` first.
 */
test("a document goes out for signature and comes back signed", async ({
  page,
}) => {
  test.slow();

  await signIn(page);

  // Open the matter the seed builds the demo around.
  await page.goto("/matters");
  await page.getByPlaceholder(/Search by title/).fill("Elm Row");
  const matterLink = page.getByRole("link", {
    name: /Residential purchase, 14 Elm Row/,
  });
  await expect(matterLink).toBeVisible();
  await matterLink.click();

  // Send the purchase contract to the client.
  await page.getByRole("link", { name: "Request signature" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Request a signature" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Send request" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Residential purchase",
  );

  // Pick the link up from the outbox, the way a client picks it out of email.
  const link = await latestLink(page, "sign");

  // --- the client's side -----------------------------------------------
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: /please review and sign/i }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Continue to sign/ }).click();
  await drawSignature(page);
  await page.getByRole("checkbox").check();

  const signButton = page.getByRole("button", { name: "Sign document" });
  await expect(signButton).toBeEnabled();
  await signButton.click();

  await expect(page.getByRole("heading", { name: /It is signed/ })).toBeVisible(
    { timeout: 30_000 },
  );

  // --- back in the workspace -------------------------------------------
  await page.goto("/matters");
  await page.getByPlaceholder(/Search by title/).fill("Elm Row");
  await page.getByRole("link", { name: /Residential purchase/ }).click();
  await page.getByRole("tab", { name: /Signatures/ }).click();

  await expect(page.getByText("Signed").first()).toBeVisible();

  // The signed PDF and its certificate are filed in the matter.
  await page.getByRole("tab", { name: /Documents/ }).click();
  await expect(page.getByText(/— signed\.pdf/).first()).toBeVisible();
});

test("a revoked link stops working for the client", async ({ page }) => {
  test.slow();

  await signIn(page);

  // The test makes its own request rather than borrowing a seeded one, so it
  // can be run twice in a row without the first run breaking the second.
  await page.goto("/matters");
  await page.getByPlaceholder(/Search by title/).fill("Supplier agreement");
  await page.getByRole("link", { name: /Supplier agreement renewal/ }).click();
  await page.getByRole("link", { name: "Request signature" }).first().click();
  await page.getByRole("button", { name: "Send request" }).click();

  // The action redirects when it is done. Without waiting for that, the next
  // navigation can outrun it and read the outbox before the email is written.
  await page.waitForURL(/\/matters\/[^/]+\?tab=signatures/);

  const link = await latestLink(page, "sign");

  // It works before it is revoked.
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: /please review and sign/i }),
  ).toBeVisible();

  // Revoke the newest request.
  await page.goto("/matters");
  await page.getByPlaceholder(/Search by title/).fill("Supplier agreement");
  await page.getByRole("link", { name: /Supplier agreement renewal/ }).click();
  await page.getByRole("tab", { name: /Signatures/ }).click();

  // Scope to the newest card. Several requests can sit on one matter, and
  // revoking the wrong one would leave the test passing for the wrong reason.
  const newest = page.locator("article").first();
  await newest.getByText("Revoke", { exact: true }).click();
  await newest.getByRole("button", { name: "Revoke link" }).click();
  await expect(newest.getByText("Revoked").first()).toBeVisible();

  // And now it does not.
  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: /no longer active|cancelled/i }),
  ).toBeVisible();
});
