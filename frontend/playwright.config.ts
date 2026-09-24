import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Retries: off locally; one in CI, and a pass-on-retry is reported as "flaky" (scripts/report_flaky.py).
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ["json", { outputFile: "e2e-results/results.json" }],
    ["html", { open: "never", outputFolder: "e2e-results/html" }],
  ],
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:8080", trace: "retain-on-failure" },
  projects: [
    { name: "gating", grepInvert: /@quarantine/, use: { ...devices["Desktop Chrome"] } },
    { name: "quarantine", grep: /@quarantine/, use: { ...devices["Desktop Chrome"] } },
  ],
});
