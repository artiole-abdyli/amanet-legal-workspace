import { expect, type Page } from "@playwright/test";

export const ADMIN = {
  email: "artiole.abdyli@abdylipartners.example",
  password: "workspace-demo",
};

export async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(ADMIN.email);
  await page.getByLabel("Password").fill(ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
}

const LINK_PATTERN = {
  sign: /https?:\/\/\S+\/sign\/[A-Za-z0-9_-]+/,
  upload: /https?:\/\/\S+\/upload\/[A-Za-z0-9_-]+/,
} as const;

/**
 * Reads the newest secure link out of the outbox.
 *
 * The emails the workspace sends are rendered at /emails, which makes them the
 * natural place for a test to pick up a link, exactly as a client would from
 * their inbox. Nothing is read out of the database: the token only ever exists
 * in the message.
 *
 * The outbox is filtered to the matching type of message, newest first, and
 * the reading pane opens on the first one, so the link is read from there.
 */
export async function latestLink(
  page: Page,
  kind: "sign" | "upload",
): Promise<string> {
  await page.goto(`/emails?kind=${kind}`);

  const reader = page.locator("article").first();
  await expect(reader).toBeVisible();
  const body = await reader.innerText();

  const match = LINK_PATTERN[kind].exec(body);
  if (match) return match[0];

  throw new Error(`no ${kind} link in the newest ${kind} message`);
}

/** Draws a short stroke across the signature pad. */
export async function drawSignature(page: Page) {
  const pad = page.getByLabel(/Signature pad/);
  const box = await pad.boundingBox();
  expect(box).not.toBeNull();

  const y = box!.y + box!.height / 2;
  await page.mouse.move(box!.x + 40, y);
  await page.mouse.down();
  await page.mouse.move(box!.x + 120, y - 20);
  await page.mouse.move(box!.x + 200, y + 10);
  await page.mouse.up();
}
