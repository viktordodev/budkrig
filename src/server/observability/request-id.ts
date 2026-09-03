import { headers } from "next/headers";
import { logger } from "./logger";

/** The id set by middleware for the current request. "unknown" outside a request. */
export async function getRequestId(): Promise<string> {
  try {
    return (await headers()).get("x-request-id") ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** A child logger bound to the current request id. Use in routes / RSC / actions. */
export async function requestLogger() {
  return logger.child({ requestId: await getRequestId() });
}
