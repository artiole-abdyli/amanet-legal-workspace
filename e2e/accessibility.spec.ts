import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { latestLink, signIn } from "./helpers";

/**
 * The brief names an accessible experience as part of how the work is judged,
 * so it is checked rather than asserted. axe cannot see everything — it will
 * not tell you whether a label reads sensibly — but it catches the failures
 * that are measurable: contrast, missing names, broken landmarks and ARIA.
 */
async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const serious = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );

  if (serious.length > 0) {
    console.log(
      `\n${label}:\n` +
        serious
          .map(
            (violation) =>
              `  [${violation.impact}] ${violation.id}: ${violation.help}\n` +
              violation.nodes
                .slice(0, 3)
                .map((node) => `      ${node.target.join(" ")}`)
                .join("\n"),
          )
          .join("\n"),
    );
  }

  expect(serious, `${label} has serious accessibility violations`).toEqual([]);
}

test.describe("accessibility", () => {
  test("the login page", async ({ page }) => {
    await page.goto("/login");
    await scan(page, "/login");
  });

  test("the workspace pages", async ({ page }) => {
    test.slow();
    await signIn(page);

    for (const path of ["/", "/matters", "/clients", "/emails", "/matters/new"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await scan(page, path);
    }
  });

  test("a matter and its tabs", async ({ page }) => {
    test.slow();
    await signIn(page);

    await page.goto("/matters");
    // Five matters a page, so find it rather than hoping it is on the first.
    await page.getByPlaceholder(/Search by title/).fill("Elm Row");
    await page.getByRole("link", { name: /Residential purchase/ }).click();
    await page.waitForLoadState("networkidle");
    await scan(page, "matter overview");

    for (const tab of ["Documents", "Client requests", "Signatures", "Tasks"]) {
      await page.getByRole("tab", { name: new RegExp(tab) }).click();
      await page.waitForLoadState("networkidle");
      await scan(page, `matter tab: ${tab}`);
    }
  });

  test("the pages a client sees", async ({ page }) => {
    test.slow();
    await signIn(page);

    // Send a request so there is a live link to open, the way a client would.
    await page.goto("/matters");
    await page.getByPlaceholder(/Search by title/).fill("Will and estate");
    await page.getByRole("link", { name: /Will and estate plan/ }).click();
    await page.getByRole("link", { name: "Request signature" }).first().click();
    await page.getByRole("button", { name: "Send request" }).click();
    await page.waitForURL(/\/matters\/[^/]+\?tab=signatures/);

    const link = await latestLink(page, "sign");

    await page.goto(link);
    await page.waitForLoadState("networkidle");
    await scan(page, "client signing, review step");

    await page.getByRole("button", { name: /Continue to sign/ }).click();
    await scan(page, "client signing, signature step");
  });
});
