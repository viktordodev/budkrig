/** App constants with no dependencies — safe to import from anywhere. */

/** Stripe wants lowercase ISO-4217. SEK only for v1 (ADR-0004). */
export const CURRENCY = "sek" as const;

/**
 * Version of the EU right-of-withdrawal waiver wording shown at checkout
 * (ADR-0007). Bump when the text changes; the text lives in the message
 * catalogs. Pending lawyer sign-off (ADR-0015).
 */
export const WITHDRAWAL_CONSENT_VERSION = "2026-09-draft-1";
