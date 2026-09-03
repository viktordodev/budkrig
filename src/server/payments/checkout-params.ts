import { CURRENCY } from "@/lib/constants";
import type Stripe from "stripe";

export interface CheckoutInput {
  readonly bidId: string;
  readonly eventKey: string;
  readonly listingSlug: string;
  /** What to charge for this bid, in öre. */
  readonly amountOre: number;
  readonly isNewListing: boolean;
  readonly customerEmail: string;
  readonly locale: "sv" | "en";
  readonly successUrl: string;
  readonly cancelUrl: string;
}

/**
 * Pure — builds the Checkout Session params (ADR-0006). Hosted Checkout, one
 * line item for the bid delta, our `eventKey` threaded through the session AND
 * the payment_intent metadata so fulfilment can find the bid from either event.
 *
 * TODO(M3 / ADR-0007): payment_method_types `["swish", "card", "klarna"]`
 * (Swish first per the 2020 SE law) + `automatic_tax` once Stripe Tax is set up.
 */
export function buildCheckoutSessionParams(
  input: CheckoutInput,
): Stripe.Checkout.SessionCreateParams {
  const label = input.isNewListing
    ? `Budkrig – placering för ${input.listingSlug}`
    : `Budkrig – höjning för ${input.listingSlug}`;

  return {
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: input.customerEmail,
    locale: input.locale,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: input.amountOre,
          product_data: { name: label },
        },
      },
    ],
    metadata: {
      bidId: input.bidId,
      eventKey: input.eventKey,
      listingSlug: input.listingSlug,
    },
    payment_intent_data: {
      metadata: { bidId: input.bidId, eventKey: input.eventKey },
    },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
  };
}
