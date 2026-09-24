import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      // Route files (async Server Components) are covered by Playwright — Vitest cannot render them.
      include: ["src/lib/**", "src/i18n/**", "src/components/**"],
      exclude: ["src/lib/api/schema.d.ts", "**/*.test.{ts,tsx}"],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 85 },
    },
  },
});
