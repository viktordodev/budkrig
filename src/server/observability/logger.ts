import { env } from "@/server/config/env";
import pino from "pino";

/**
 * Structured JSON logs to stdout (ADR-0013). Never log raw PII — `owner_email`,
 * bare emails, auth headers and cookies are redacted.
 *
 * Dev tip: `pnpm dev | pnpm dlx pino-pretty` for readable output. We keep JSON
 * everywhere so local and production logs are the same shape.
 */
export const logger = pino({
  level: env.LOG_LEVEL ?? "info",
  base: { app: "budkrig", env: env.APP_ENV ?? "local" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "*.ownerEmail",
      "*.owner_email",
      "*.email",
      "email",
    ],
    censor: "[redacted]",
  },
});

export type Logger = typeof logger;
