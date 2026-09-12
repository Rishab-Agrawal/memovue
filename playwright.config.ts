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

  /*
    Its own server, every time, and it refuses to run beside somebody else's.

    `npm start` is `next start`, which reads the build manifest once at boot and then serves
    the chunk filenames it found there for the rest of its life. Rebuild while one is running
    and every one of those files is replaced by a differently-hashed copy, so the server that
    is still up answers 500 and `text/plain` for the whole bundle — no stylesheet, no
    hydration. The suite then fails in the strangest possible way: every control is present
    and correctly disabled, because the state behind it never came alive, and the landing page
    scrolls sideways because there is no CSS. Nine tests failed and thirteen never ran, for a
    server nobody remembered leaving open.

    Reusing one was the convenience that hid it. Now the run either starts its own against the
    build on disk or stops and says the port is taken — which costs a few seconds, and is the
    difference between a suite that tests this commit and one that tests whatever was built
    last week.
  */
  webServer: {
    command: "npm run start",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
