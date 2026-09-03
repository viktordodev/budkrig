/**
 * Runs once per server process (web and — via tsup — not the worker; the worker
 * initialises its own). Seam for error tracking + OpenTelemetry (ADR-0013).
 * Wiring @sentry/nextjs or an OTLP exporter goes here once a collector exists.
 */
export async function register(): Promise<void> {
  const { env } = await import("@/server/config/env");
  if (env.SENTRY_DSN) {
    // TODO(M1-finish): initialise @sentry/nextjs here.
  }
  if (env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    // TODO(M1-finish): initialise the OTLP trace/metric exporters here.
  }
}

/**
 * Next calls this for every unhandled error in a route / RSC / Route Handler.
 * For now it just structured-logs; forward to the error tracker once wired.
 */
export async function onRequestError(
  error: unknown,
  request: { path: string; method: string; headers: { [key: string]: string | undefined } },
): Promise<void> {
  const { logger } = await import("@/server/observability/logger");
  logger.error(
    {
      err: error,
      path: request.path,
      method: request.method,
      requestId: request.headers["x-request-id"],
    },
    "unhandled request error",
  );
}
