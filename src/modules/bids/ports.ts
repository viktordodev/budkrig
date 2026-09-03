import type { FulfilmentDecision } from "./fulfil";
import type { PaymentMethod } from "./types";

/** Injected so time is deterministic in tests. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

/**
 * A payment the PSP has confirmed as settled, normalised from a provider event
 * (core-flows Flow 1b). `eventKey` is our idempotency token, round-tripped
 * through the provider's metadata.
 */
export interface SettledPaymentEvent {
  readonly provider: "stripe";
  readonly providerEventId: string;
  readonly providerPaymentIntent: string;
  readonly method: PaymentMethod;
  readonly eventKey: string;
  readonly type: string;
  /** The raw provider event, stored on the payment row for audit. */
  readonly payload: unknown;
}

/**
 * The fulfilment transaction (ADR-0004 / ADR-0005). The implementation opens
 * one DB transaction: records the webhook event (idempotency), loads the bid /
 * payment / listing (listing `FOR UPDATE`), runs `decideFulfilment`, applies
 * the writes, and commits. Returns what happened so the caller can invalidate
 * caches and enqueue the receipt.
 */
export interface FulfilmentRepository {
  fulfil(event: SettledPaymentEvent): Promise<FulfilmentDecision>;
}
