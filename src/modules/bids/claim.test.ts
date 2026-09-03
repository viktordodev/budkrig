import { ore } from "@/lib/money";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { planClaim } from "./claim";
import type { ThresholdConfig } from "./threshold";

const config: ThresholdConfig = { newListingMinOre: ore(500), minIncrementOre: ore(100) };

describe("planClaim", () => {
  it("plans a brand-new listing at the new-listing minimum", () => {
    const r = planClaim({ existing: null, targetAmountOre: ore(500), config });
    expect(r).toEqual({
      ok: true,
      value: { previousAmountOre: 0, deltaOre: 500, resultingAmountOre: 500, isNewListing: true },
    });
  });

  it("rejects a new listing below the minimum", () => {
    expect(planClaim({ existing: null, targetAmountOre: ore(400), config })).toMatchObject({
      ok: false,
      error: { kind: "below_minimum", requiredOre: 500 },
    });
  });

  it("plans a raise off the listing's current amount", () => {
    const r = planClaim({
      existing: { currentAmountOre: 12_000, status: "active" },
      targetAmountOre: ore(15_000),
      config,
    });
    expect(r).toEqual({
      ok: true,
      value: {
        previousAmountOre: 12_000,
        deltaOre: 3_000,
        resultingAmountOre: 15_000,
        isNewListing: false,
      },
    });
  });

  it("rejects a raise that does not clear current + increment", () => {
    expect(
      planClaim({
        existing: { currentAmountOre: 12_000, status: "active" },
        targetAmountOre: ore(12_050),
        config,
      }),
    ).toMatchObject({ ok: false, error: { kind: "below_minimum", requiredOre: 12_100 } });
  });

  it("property: an accepted plan always has delta = target - previous > 0", () => {
    fc.assert(
      fc.property(
        fc.option(fc.nat({ max: 5_000_000 }), { nil: undefined }),
        fc.nat({ max: 5_000_000 }),
        (existingAmount, extra) => {
          const previous = existingAmount ?? 0;
          const required = Math.max(config.newListingMinOre, previous + config.minIncrementOre);
          const target = required + extra;
          const r = planClaim({
            existing:
              existingAmount === undefined
                ? null
                : { currentAmountOre: existingAmount, status: "active" },
            targetAmountOre: ore(target),
            config,
          });
          expect(r.ok).toBe(true);
          if (r.ok) {
            expect(r.value.deltaOre).toBe(target - previous);
            expect(r.value.deltaOre).toBeGreaterThan(0);
            expect(r.value.isNewListing).toBe(existingAmount === undefined);
          }
        },
      ),
    );
  });
});
