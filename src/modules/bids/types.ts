/** Row shapes the bid module reasons about. Mirror the DB enums (schema.ts). */

export type ListingStatus = "draft" | "pending_payment" | "active" | "hidden" | "removed";
export type BidStatus = "pending" | "settled" | "expired" | "refunded";
export type PaymentStatus = "pending" | "settled" | "disputed" | "refunded" | "expired";
export type PaymentMethod = "card" | "swish" | "klarna" | "wallet" | "other";
export type TaxMode = "b2c_se" | "b2b_eu_reverse_charge" | "b2b_domestic" | "non_eu";

export interface ListingState {
  readonly id: string;
  readonly slug: string;
  readonly status: ListingStatus;
  readonly currentAmountOre: number;
  readonly firstActiveAt: Date | null;
}

export interface BidState {
  readonly id: string;
  readonly listingId: string;
  /** What Stripe is/was asked to charge for this bid. Fixed at claim time. */
  readonly deltaOre: number;
  readonly status: BidStatus;
  /** Our idempotency token, also sent to Stripe as metadata. */
  readonly eventKey: string;
  readonly providerPaymentIntent: string | null;
}

export interface PaymentState {
  readonly id: string;
  readonly bidId: string;
  readonly status: PaymentStatus;
  /** Gross amount Stripe settled. Must equal the bid's deltaOre. */
  readonly amountOre: number;
}
