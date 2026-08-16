import { defineConfig, devices } from "@playwright/test";

/**
 * The prototype has no database, no auth and no API, so it deliberately does not reuse
 * playwright.config.ts — that one runs a globalSetup which opens a Prisma connection and
 * boots the production server. This one just needs `next dev`.
 */
const BASE_URL = process.env.PROTO_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/proto",
  fullyParallel: true,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: { baseURL: BASE_URL, trace: "retain-on-failure" },
  projects: [{ name: "phone", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
