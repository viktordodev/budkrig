/**
 * Money in Budkrig is ALWAYS an integer number of öre (1 kr = 100 öre).
 * No floats on the money path (ADR-0004). Format only at the view layer.
 */

declare const oreBrand: unique symbol;
/** A non-negative integer count of öre. */
export type Ore = number & { readonly [oreBrand]: true };

export function ore(n: number): Ore {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`ore() requires a non-negative integer, got ${n}`);
  }
  return n as Ore;
}

/** 12.5 kr -> 1250 öre. Accepts kronor with at most 2 decimals. */
export function fromKronor(kronor: number): Ore {
  const cents = Math.round(kronor * 100);
  if (Math.abs(cents - kronor * 100) > 1e-6) {
    throw new Error(`fromKronor(): more than 2 decimals: ${kronor}`);
  }
  return ore(cents);
}

export function addOre(a: Ore, b: Ore): Ore {
  return ore(a + b);
}

export function subOre(a: Ore, b: Ore): Ore {
  return ore(a - b);
}

export const ZERO_ORE = 0 as Ore;

/**
 * The floor a claim/raise must clear (ADR-0005):
 *   max(newListingMin, previousAmount + minIncrement)
 */
export function requiredMinimum(params: {
  previousAmount: Ore;
  newListingMin: Ore;
  minIncrement: Ore;
}): Ore {
  const raised = addOre(params.previousAmount, params.minIncrement);
  return ore(Math.max(params.newListingMin, raised));
}

/** View layer only. 1700500 -> "17 005 kr" (sv-SE grouping). */
export function formatKr(amount: Ore, locale = "sv-SE"): string {
  const kronor = amount / 100;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: Number.isInteger(kronor) ? 0 : 2,
  }).format(kronor);
}
