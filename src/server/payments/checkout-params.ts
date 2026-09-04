import { CURRENCY } from "@/lib/constants";
import type Stripe from "stripe";

export interface CheckoutInput {
  readonly bidId: string;
  readonly eventKey: string;
  readonly listingSlug: string;
  /** What to charge for this bid, in öre — VAT-inclusive (ADR-0007). */
  readonly amountOre: number;
  readonly isNewListing: boolean;
  readonly customerEmail: string;
  readonly locale: "sv" | "en";
  readonly successUrl: string;
  readonly cancelUrl: string;
  /** Only enable when Stripe Tax is activated on the account. */
  readonly taxEnabled: boolean;
  /** In display order — Swish before credit (ADR-0007). */
  readonly paymentMethods: string[];
}

/**
 * Pure — builds the Checkout Session params (ADR-0006 / ADR-0007). Hosted
 * Checkout, Swish → card → Klarna, one VAT-inclusive line item for the bid
 * delta, our `eventKey` in the session AND the payment_intent metadata.
 */
export function buildCheckoutSessionParams(
  input: CheckoutInput,
): Stripe.Checkout.SessionCreateParams {
  const label = input.isNewListing
    ? `Budkrig – placering för ${input.listingSlug}`
    : `Budkrig – höjning för ${input.listingSlug}`;

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_method_types:
      input.paymentMethods as Stripe.Checkout.SessionCreateParams.PaymentMethodType[],
    customer_email: input.customerEmail,
    locale: input.locale,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: CURRENCY,
          unit_amount: input.amountOre,
          product_data: { name: label },
          ...(input.taxEnabled ? { tax_behavior: "inclusive" } : {}),
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

  if (input.taxEnabled) {
    params.automatic_tax = { enabled: true };
    params.tax_id_collection = { enabled: true };
    params.billing_address_collection = "required";
  }

  return params;
}
