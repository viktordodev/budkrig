import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Integration tests (Testcontainers, real Postgres) run in their own config
    // and CI job — they need a Docker daemon. See vitest.integration.config.ts.
    exclude: ["**/*.integration.test.ts", "node_modules/**", "dist/**", ".next/**"],
  },
});
