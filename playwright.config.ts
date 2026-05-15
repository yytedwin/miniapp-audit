import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: "http://localhost:3100",
    headless: true,
  },
  webServer: {
    command: "next dev -p 3100",
    port: 3100,
    reuseExistingServer: false,
    timeout: 15000,
  },
});
