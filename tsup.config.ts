import { defineConfig } from "tsup";

/**
 * Bundles the worker (src/workers/main.ts) into dist/workers/main.js.
 * App code under src/ is bundled (so the "@/*" path alias resolves);
 * npm dependencies stay external and are provided by node_modules at runtime.
 * Run: pnpm build:worker  ·  Start: node dist/workers/main.js
 */
export default defineConfig({
  entry: ["src/workers/main.ts"],
  outDir: "dist/workers",
  format: ["esm"],
  target: "node24",
  platform: "node",
  clean: true,
  sourcemap: true,
  dts: false,
  // dependencies + peerDependencies are external by default in tsup.
});
