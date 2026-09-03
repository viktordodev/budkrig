import type { PaymentMethod } from "@/modules/bids/types";

/**
 * Map a Stripe `payment_method_types` / `payment_method_details.type` string to
 * our coarse `payment_method` enum. Unknown types fall through to "other" —
 * they still settle, they just aren't broken out in reports.
 */
export function toPaymentMethod(stripeType: string | null | undefined): PaymentMethod {
  switch (stripeType) {
    case "card":
      return "card";
    case "swish":
      return "swish";
    case "klarna":
      return "klarna";
    case "link":
    case "apple_pay":
    case "google_pay":
    case "revolut_pay":
      return "wallet";
    default:
      return "other";
  }
}
