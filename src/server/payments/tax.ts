import type { TaxMode } from "@/modules/bids/types";

/**
 * Classify a settled Checkout Session for VAT (ADR-0007). Pure.
 *
 * - Swedish buyer / EU B2C  → 25 % Swedish moms (`b2c_se`)
 * - EU business with a valid VAT number outside SE → reverse charge, 0 %
 *   (Stripe applies it; `amount_tax` comes back 0)
 * - Non-EU → outside scope of Swedish VAT
 *
 * The lawyer/accountant confirm the edge cases (ADR-0015); this is the code's
 * best guess from what Checkout collects.
 */
const EU = new Set([
  "AT",
  "BE",
  "BG",
  "HR",
  "CY",
  "CZ",
  "DK",
  "EE",
  "FI",
  "FR",
  "DE",
  "GR",
  "HU",
  "IE",
  "IT",
  "LV",
  "LT",
  "LU",
  "MT",
  "NL",
  "PL",
  "PT",
  "RO",
  "SK",
  "SI",
  "ES",
  "SE",
]);

export function deriveTaxMode(input: {
  countryCode: string | null;
  hasEuVatId: boolean;
  amountTaxOre: number | null;
}): TaxMode {
  const country = input.countryCode?.toUpperCase() ?? null;

  if (country === "SE") return "b2c_se";
  if (country && !EU.has(country)) return "non_eu";
  if (country && EU.has(country)) {
    // reverse charge iff Stripe validated an EU VAT id and charged no tax
    if (input.hasEuVatId && (input.amountTaxOre ?? 0) === 0) return "b2b_eu_reverse_charge";
    return "b2c_se"; // EU consumer — Swedish moms via OSS
  }
  // country unknown — assume domestic consumer, flag for review
  return "b2c_se";
}

/** VAT rate as a decimal string ("0.25"), or "0" for reverse charge / non-EU. */
export function vatRateOf(grossOre: number, amountTaxOre: number | null): string {
  const tax = amountTaxOre ?? 0;
  const net = grossOre - tax;
  if (tax === 0 || net <= 0) return "0";
  return (Math.round((tax / net) * 100) / 100).toFixed(2);
}
