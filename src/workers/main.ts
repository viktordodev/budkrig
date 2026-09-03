/**
 * Worker entrypoint (ADR-0010). Same image as the web app; started with
 * `node dist/workers/main.js`. Composition root — wire server/ adapters into
 * modules/ here, then register BullMQ workers + repeatable jobs.
 *
 * This is a stub. See src/workers/README.md for the processor list.
 */
import { env } from "@/server/config/env";

async function main(): Promise<void> {
  // eslint-disable-next-line no-console -- worker allowed (see biome.json override)
  console.log(`[worker] starting in ${env.APP_ENV}`);

  // TODO(M1): new Worker("fulfil-payment", processor, { connection })
  // TODO(M1): queue.add(..., { repeat: { pattern: "*/5 * * * *" } }) for cron jobs

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, draining…`);
    // TODO: await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void main();
