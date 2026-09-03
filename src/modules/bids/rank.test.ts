import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type RankableListing, compareForBoard, positionOf, rankBoard } from "./rank";

const L = (id: string, amount: number, activeAtMs: number): RankableListing => ({
  id,
  currentAmountOre: amount,
  firstActiveAt: new Date(activeAtMs),
});

describe("rankBoard", () => {
  it("orders by amount desc", () => {
    const ranked = rankBoard([L("a", 100, 0), L("b", 300, 0), L("c", 200, 0)]);
    expect(ranked.map((l) => l.id)).toEqual(["b", "c", "a"]);
  });

  it("breaks amount ties by firstActiveAt asc — the incumbent stays ahead", () => {
    const incumbent = L("old", 1000, 1_000);
    const challenger = L("new", 1000, 2_000);
    expect(rankBoard([challenger, incumbent]).map((l) => l.id)).toEqual(["old", "new"]);
  });

  it("does not mutate the input", () => {
    const input = [L("a", 100, 0), L("b", 300, 0)];
    rankBoard(input);
    expect(input.map((l) => l.id)).toEqual(["a", "b"]);
  });

  it("property: rankBoard is a total order consistent with compareForBoard", () => {
    const listing = fc.record({
      id: fc.uuid(),
      currentAmountOre: fc.nat({ max: 10_000_000 }),
      firstActiveAt: fc.date({ min: new Date(0), max: new Date(2_000_000_000_000) }),
    });
    fc.assert(
      fc.property(fc.uniqueArray(listing, { selector: (l) => l.id, maxLength: 50 }), (listings) => {
        const ranked = rankBoard(listings);
        for (let i = 1; i < ranked.length; i++) {
          expect(
            compareForBoard(ranked[i - 1] as RankableListing, ranked[i] as RankableListing),
          ).toBeLessThanOrEqual(0);
        }
      }),
    );
  });
});

describe("positionOf", () => {
  const board = [L("a", 300, 10), L("b", 200, 10), L("c", 100, 10)];

  it("is 1 for the top listing", () => {
    expect(positionOf(L("a", 300, 10), board)).toBe(1);
  });

  it("counts listings strictly ahead, +1", () => {
    expect(positionOf(L("b", 200, 10), board)).toBe(2);
    expect(positionOf(L("c", 100, 10), board)).toBe(3);
  });

  it("works when the target is not on the board", () => {
    expect(positionOf(L("x", 250, 10), board)).toBe(2);
    expect(positionOf(L("x", 500, 10), board)).toBe(1);
    expect(positionOf(L("x", 50, 10), board)).toBe(4);
  });

  it("a later challenger matching #1's amount is #2, not #1", () => {
    expect(positionOf(L("x", 300, 99), board)).toBe(2);
  });

  it("property: positionOf agrees with the index in rankBoard", () => {
    const listing = fc.record({
      id: fc.uuid(),
      currentAmountOre: fc.nat({ max: 1_000_000 }),
      firstActiveAt: fc.date({ min: new Date(0), max: new Date(2_000_000_000_000) }),
    });
    fc.assert(
      fc.property(
        fc.uniqueArray(listing, { selector: (l) => l.id, minLength: 1, maxLength: 40 }),
        (listings) => {
          const ranked = rankBoard(listings);
          ranked.forEach((l, i) => {
            expect(positionOf(l, listings)).toBe(i + 1);
          });
        },
      ),
    );
  });
});
