import { env } from "@/server/config/env";
import { logger } from "@/server/observability/logger";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Applies pending migrations from src/server/db/migrations. Forward-only,
 * expand/contract (ADR-0003 / conventions). Run as the Coolify pre-deploy
 * command so a bad migration fails the deploy instead of crash-looping.
 *
 *   local: pnpm db:migrate
 *   image: node dist/server/db/migrate.js
 *
 * Needs only `drizzle-orm` + `postgres` + the .sql files — no drizzle-kit, no
 * drizzle.config.ts, no schema.ts.
 */
const url = env.DATABASE_MIGRATION_URL ?? env.DATABASE_URL;
if (!url) {
  logger.error("db:migrate — DATABASE_MIGRATION_URL or DATABASE_URL must be set");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

try {
  await migrate(drizzle(sql), { migrationsFolder: "src/server/db/migrations" });
  logger.info("db:migrate — up to date");
  await sql.end();
  process.exit(0);
} catch (err) {
  logger.error({ err }, "db:migrate — failed");
  await sql.end({ timeout: 5 }).catch(() => {});
  process.exit(1);
}
