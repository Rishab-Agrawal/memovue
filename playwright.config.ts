import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests",
  // Unit specs have their own config and need neither a database nor a server.
  testIgnore: ["**/unit/**"],
  globalSetup: "./tests/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "phone",
      use: {
        ...devices["Pixel 7"],
        permissions: ["camera"],
        launchOptions: {
          args: [
            // Chromium synthesises a rolling test pattern on /dev/video, which is what
            // lets the capture → compress → R2 upload path run for real in CI.
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
          ],
        },
      },
    },
  ],

  webServer: {
    command: "npm run start",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
