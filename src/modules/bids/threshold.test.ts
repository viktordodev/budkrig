import { ore } from "@/lib/money";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type ThresholdConfig, checkAmount } from "./threshold";

const config: ThresholdConfig = { newListingMinOre: ore(500), minIncrementOre: ore(100) };

describe("checkAmount", () => {
  it("accepts a new listing at exactly the new-listing minimum", () => {
    const r = checkAmount({ previousAmountOre: ore(0), targetAmountOre: ore(500), config });
    expect(r).toEqual({
      ok: true,
      value: { previousAmountOre: 0, deltaOre: 500, resultingAmountOre: 500 },
    });
  });

  it("rejects a new listing below the minimum, reporting the required amount", () => {
    const r = checkAmount({ previousAmountOre: ore(0), targetAmountOre: ore(499), config });
    expect(r).toEqual({
      ok: false,
      error: { kind: "below_minimum", requiredOre: 500, gotOre: 499 },
    });
  });

  it("accepts a raise of exactly the minimum increment", () => {
    const r = checkAmount({
      previousAmountOre: ore(1_700_000),
      targetAmountOre: ore(1_700_100),
      config,
    });
    expect(r).toMatchObject({ ok: true, value: { deltaOre: 100, resultingAmountOre: 1_700_100 } });
  });

  it("rejects a raise that does not clear previous + increment", () => {
    for (const target of [1_700_000, 1_700_050, 1_700_099]) {
      const r = checkAmount({
        previousAmountOre: ore(1_700_000),
        targetAmountOre: ore(target),
        config,
      });
      expect(r).toMatchObject({
        ok: false,
        error: { kind: "below_minimum", requiredOre: 1_700_100 },
      });
    }
  });

  it("property: target >= required is accepted with delta = target - previous", () => {
    fc.assert(
      fc.property(fc.nat({ max: 5_000_000 }), fc.nat({ max: 5_000_000 }), (previous, extra) => {
        const required = Math.max(config.newListingMinOre, previous + config.minIncrementOre);
        const target = required + extra;
        const r = checkAmount({
          previousAmountOre: ore(previous),
          targetAmountOre: ore(target),
          config,
        });
        expect(r.ok).toBe(true);
        if (r.ok) {
          expect(r.value.deltaOre).toBe(target - previous);
          expect(r.value.resultingAmountOre).toBe(target);
          expect(r.value.deltaOre).toBeGreaterThan(0);
        }
      }),
    );
  });

  it("property: target < required is always rejected", () => {
    fc.assert(
      fc.property(fc.nat({ max: 5_000_000 }), fc.nat({ max: 1_000_000 }), (previous, under) => {
        const required = Math.max(config.newListingMinOre, previous + config.minIncrementOre);
        const target = Math.max(0, required - 1 - under);
        const r = checkAmount({
          previousAmountOre: ore(previous),
          targetAmountOre: ore(target),
          config,
        });
        expect(r).toMatchObject({
          ok: false,
          error: { kind: "below_minimum", requiredOre: required },
        });
      }),
    );
  });
});
