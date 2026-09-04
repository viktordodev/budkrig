import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Integration tests: `*.integration.test.ts`, real Postgres via Testcontainers
 * (ADR-0014). Needs a Docker daemon — this is the `integration` CI job, not
 * `pnpm test`. Run locally with `pnpm test:integration` if you have Docker.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // Real DB comes from Testcontainers; the app env must not be required.
    env: { SKIP_ENV_VALIDATION: "1" },
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 240_000,
    // One shared container, files run sequentially.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    fileParallelism: false,
  },
});
