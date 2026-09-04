import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Run E2E against a production build, not `next dev`: dev mode compiles each
  // route on-demand on its first request, which on this toolchain can take long
  // enough to make E2E assertions flaky/fail outright on a cold server — and a
  // production build is what actually ships (see docker-compose.yml's `next
  // start`), so this is also more representative of the deployed app.
  webServer: {
    command: "pnpm build && pnpm start",
    port: 3000,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: { baseURL: "http://localhost:3000" },
});
