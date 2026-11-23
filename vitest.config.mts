import path from "node:path";

import { defineConfig } from "vitest/config";

/**
 * Unit tests run against the library layer, with no database and no browser,
 * so `npm test` works on a clean checkout before anything else is set up.
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
