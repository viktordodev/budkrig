import { env } from "@/server/config/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Pooled Postgres client (ADR-0003). The pool ceiling is deliberately low so a
 * traffic spike can't exhaust Postgres (N4). Object keys are camelCase and
 * columns snake_case — `casing` must match drizzle.config.ts.
 *
 * `postgres()` is lazy: no connection is opened until the first query, so
 * importing this module during `next build` is safe.
 */
const connectionString = env.DATABASE_URL ?? "postgres://invalid";

const queryClient = postgres(connectionString, {
  max: env.DATABASE_POOL_MAX ?? 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema, casing: "snake_case" });
export { schema };

/** Cheap round-trip for readiness checks. Throws if the DB is unreachable. */
export async function pingDb(): Promise<void> {
  await queryClient`select 1`;
}
