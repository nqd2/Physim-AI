import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 70_000,
  use: {
    baseURL: "http://127.0.0.1:8081",
    viewport: { width: 390, height: 844 },
    launchOptions: process.env.PHYSIM_CHROME ? { executablePath: process.env.PHYSIM_CHROME } : {},
  },
  webServer: [
    {
      command: "pnpm --filter @physim/server dev",
      url: "http://127.0.0.1:3000/api/v1/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @physim/mobile dev --web --port 8081",
      url: "http://127.0.0.1:8081",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
