import { defineConfig } from "tsup";

/**
 * Bundles the Node-side entrypoints. App code under src/ is bundled (so the
 * "@/*" path alias resolves); npm dependencies stay external and come from
 * node_modules at runtime.
 *
 *   dist/workers/main.js        pnpm worker        / node dist/workers/main.js
 *   dist/server/db/migrate.js   pnpm db:migrate    / node dist/server/db/migrate.js
 *   dist/server/db/seed.js      pnpm db:seed       / node dist/server/db/seed.js
 */
export default defineConfig({
  entry: ["src/workers/main.ts", "src/server/db/migrate.ts", "src/server/db/seed.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node24",
  platform: "node",
  clean: true,
  sourcemap: true,
  dts: false,
});
