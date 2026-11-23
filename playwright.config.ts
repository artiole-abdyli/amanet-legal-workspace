import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a real server and a real database.
 *
 * They write: signing a document and accepting an upload change rows. Reset
 * the data first with `npm run db:reset`, which is what `npm run test:e2e`
 * expects you to have done.
 *
 * `reuseExistingServer` means a dev server you already have open is used as
 * it is, instead of a second one fighting it for port 3000.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.APP_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: process.env.APP_URL ?? "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
