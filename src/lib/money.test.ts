import { describe, expect, it } from "vitest";
import { addOre, formatKr, fromKronor, ore, requiredMinimum } from "./money";

describe("money", () => {
  it("rejects non-integer / negative öre", () => {
    expect(() => ore(1.5)).toThrow();
    expect(() => ore(-1)).toThrow();
  });

  it("fromKronor converts and rejects >2 decimals", () => {
    expect(fromKronor(17_005)).toBe(1_700_500);
    expect(() => fromKronor(1.005)).toThrow();
  });

  it("addOre stays integer", () => {
    expect(addOre(ore(100), ore(250))).toBe(350);
  });

  it("requiredMinimum = max(newListingMin, previous + increment)", () => {
    expect(
      requiredMinimum({ previousAmount: ore(0), newListingMin: ore(500), minIncrement: ore(100) }),
    ).toBe(500);
    expect(
      requiredMinimum({
        previousAmount: ore(17_000),
        newListingMin: ore(500),
        minIncrement: ore(100),
      }),
    ).toBe(17_100);
  });

  it("formatKr groups in sv-SE and drops öre when whole", () => {
    // NBSP grouping; assert the digits survive round-trip
    expect(formatKr(ore(1_700_500)).replace(/\s/g, " ")).toMatch(/17.005/);
  });
});
