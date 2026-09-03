import { defineConfig } from "drizzle-kit";

// Migrations use the elevated migration role, not the app role (ADR-0003).
export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./src/server/db/migrations",
  dialect: "postgresql",
  // Object keys are camelCase; columns are snake_case. The db client
  // (src/server/db/client.ts) must set the same option.
  casing: "snake_case",
  dbCredentials: {
    url: process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
