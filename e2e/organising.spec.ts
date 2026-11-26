import { expect, test } from "@playwright/test";

import { latestLink, signIn } from "./helpers";

async function openMatter(page: import("@playwright/test").Page, title: RegExp) {
  await page.goto("/matters");
  await page.getByPlaceholder(/Search by title/).fill("Supplier agreement");
  await page.getByRole("link", { name: title }).click();
}

test("a cancelled document request closes its upload link", async ({ page }) => {
  test.slow();
  await signIn(page);

  const title = `Board minutes ${Date.now()}`;
  await openMatter(page, /Supplier agreement renewal/);
  await page.getByRole("link", { name: "Request documents" }).first().click();
  await page.getByLabel(/What do you need/).fill(title);
  await page.getByRole("button", { name: /Send request/ }).click();
  await page.waitForURL(/\?tab=requests/);

  const link = await latestLink(page, "upload");
  await page.goto(link);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await openMatter(page, /Supplier agreement renewal/);
  await page.getByRole("tab", { name: /Client requests/ }).click();
  const card = page.locator("article", { hasText: title });
  await card.locator("summary", { hasText: "Cancel request" }).click();
  await card.getByRole("button", { name: "Cancel request" }).click();
  await expect(card.getByText("Cancelled").first()).toBeVisible();

  await page.goto(link);
  await expect(
    page.getByRole("heading", { name: /no longer active/i }),
  ).toBeVisible();
});

test("a task can be edited and deleted", async ({ page }) => {
  await signIn(page);
  const title = `Check exhibits ${Date.now()}`;

  await openMatter(page, /Supplier agreement renewal/);
  await page.getByRole("tab", { name: /Tasks/ }).click();
  await page.getByPlaceholder("Add a task").fill(title);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText(title)).toBeVisible();

  await page.getByLabel(`Edit task: ${title}`).click();
  const renamed = `${title} (revised)`;
  const editor = page.locator("details[open]");
  await editor.getByRole("textbox", { name: "Task", exact: true }).fill(renamed);
  await editor.getByRole("button", { name: "Save task" }).click();
  await expect(page.getByText(renamed)).toBeVisible();

  await page.getByLabel(`Edit task: ${renamed}`).click();
  await page.locator("details[open]").getByRole("button", { name: "Delete task" }).click();
  await expect(page.getByText(renamed)).toHaveCount(0);
});

test("a document can be renamed, archived and restored", async ({ page }) => {
  test.slow();
  await signIn(page);
  const stamp = Date.now();
  const original = `Side letter ${stamp}.pdf`;
  const renamed = `Side letter ${stamp} (final).pdf`;

  await openMatter(page, /Supplier agreement renewal/);
  await page.getByRole("tab", { name: /Documents/ }).click();
  await page.getByRole("link", { name: "Upload PDF" }).click();
  await page.getByLabel("PDF file").setInputFiles({
    name: original,
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%test\n"),
  });
  await page.getByRole("button", { name: "Upload" }).click();
  await page.waitForURL(/\?tab=documents/);

  await page.getByLabel(`Organise ${original}`).click();
  const menu = page.locator("details[open]");
  await menu.getByLabel("Name").fill(renamed);
  await menu.getByRole("button", { name: "Rename" }).click();
  await expect(page.getByRole("link", { name: renamed, exact: true })).toBeVisible();

  await page.getByLabel(`Organise ${renamed}`).click();
  await page.locator("details[open]").getByRole("button", { name: "Archive document" }).click();
  await expect(page.getByRole("link", { name: renamed, exact: true })).toHaveCount(0);

  await page.getByText(/Archived documents/).click();
  const shelf = page.locator("li", { hasText: renamed });
  await shelf.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByLabel(`Organise ${renamed}`)).toBeVisible();
});
