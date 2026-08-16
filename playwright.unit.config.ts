import { defineConfig } from "@playwright/test";

/**
 * Pure logic. No browser, no server, no database.
 *
 * These have to stay runnable when the app does not compile and when nothing is deployed —
 * the access rules are exactly what you want to check while the rest is in pieces. That is
 * why this config has neither a `webServer` nor a `globalSetup`.
 */
export default defineConfig({
  testDir: "./tests/unit",
  fullyParallel: true,
  reporter: [["list"]],
  timeout: 10_000,
});
