import * as schema from "@/server/db/schema";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

export interface TestDb {
  readonly db: PostgresJsDatabase<typeof schema>;
  readonly sql: postgres.Sql;
  readonly container: StartedPostgreSqlContainer;
  truncateAll(): Promise<void>;
  close(): Promise<void>;
}

/**
 * A disposable Postgres in a container, migrated to head (ADR-0014). Needs a
 * Docker daemon — these tests are the `integration` CI job, not `pnpm test`.
 */
export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer("postgres:16-bookworm").start();
  const sql = postgres(container.getConnectionUri(), { max: 8, onnotice: () => {} });
  const db = drizzle(sql, { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: "src/server/db/migrations" });

  return {
    db,
    sql,
    container,
    async truncateAll() {
      await sql`truncate table
        webhook_events, moderation_actions, click_events, payments, bids, listings, denylist, categories
        restart identity cascade`;
    },
    async close() {
      await sql.end({ timeout: 5 });
      await container.stop();
    },
  };
}
