import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:9176/escalada/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    { name: "iphone", use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "android", use: { browserName: "chromium", viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
    { name: "minimum", use: { browserName: "chromium", viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true } }
  ],
  webServer: {
    command: "npm run dev -- --port 9176",
    env: {
      VITE_E2E_AUTH_USER_ID: "e2e-supabase-user",
      VITE_E2E_AUTH_EMAIL: "e2e@example.com"
    },
    url: "http://127.0.0.1:9176/escalada/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
