import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type BidLedgerEntry, checkLedgerConsistency, currentAmountFromLedger } from "./ledger";

const at = (ms: number) => new Date(2026, 0, 1, 0, 0, 0, ms);

function settled(previous: number, delta: number, settledAtMs: number): BidLedgerEntry {
  return {
    previousAmountOre: previous,
    deltaOre: delta,
    resultingAmountOre: previous + delta,
    status: "settled",
    settledAt: at(settledAtMs),
  };
}

/** A valid chain of settled bids, `settledAt` strictly increasing. */
const validChain = fc
  .array(fc.integer({ min: 1, max: 10_000 }), { maxLength: 40 })
  .map((deltas) => {
    let previous = 0;
    return deltas.map((delta, i) => {
      const e = settled(previous, delta, i + 1);
      previous += delta;
      return e;
    });
  });

describe("currentAmountFromLedger", () => {
  it("is 0 for an empty ledger", () => {
    expect(currentAmountFromLedger([])).toBe(0);
  });

  it("ignores pending / expired / refunded bids", () => {
    const entries: BidLedgerEntry[] = [
      settled(0, 500, 1),
      {
        previousAmountOre: 500,
        deltaOre: 300,
        resultingAmountOre: 800,
        status: "pending",
        settledAt: null,
      },
      {
        previousAmountOre: 500,
        deltaOre: 999,
        resultingAmountOre: 1499,
        status: "expired",
        settledAt: null,
      },
    ];
    expect(currentAmountFromLedger(entries)).toBe(500);
  });

  it("takes the most recent settled bid by settledAt, not array order", () => {
    const entries = [settled(600, 400, 30), settled(0, 200, 10), settled(200, 400, 20)];
    expect(currentAmountFromLedger(entries)).toBe(1000);
  });

  it("property: equals the last resulting amount, regardless of array order", () => {
    fc.assert(
      fc.property(validChain, (entries) => {
        fc.pre(entries.length > 0);
        const expected = entries.at(-1)?.resultingAmountOre;
        expect(currentAmountFromLedger(entries)).toBe(expected);
        expect(currentAmountFromLedger([...entries].reverse())).toBe(expected);
      }),
    );
  });
});

describe("checkLedgerConsistency", () => {
  it("accepts a valid chain", () => {
    expect(
      checkLedgerConsistency([settled(0, 500, 1), settled(500, 100, 2), settled(600, 50, 3)]),
    ).toEqual({
      ok: true,
      value: undefined,
    });
  });

  it("property: any valid chain is consistent, in any array order", () => {
    fc.assert(
      fc.property(validChain, (entries) => {
        expect(checkLedgerConsistency(entries).ok).toBe(true);
        expect(checkLedgerConsistency([...entries].reverse()).ok).toBe(true);
      }),
    );
  });

  it("flags a non-positive delta", () => {
    const bad: BidLedgerEntry = {
      previousAmountOre: 500,
      deltaOre: 0,
      resultingAmountOre: 500,
      status: "settled",
      settledAt: at(2),
    };
    expect(checkLedgerConsistency([settled(0, 500, 1), bad])).toEqual({
      ok: false,
      error: { kind: "delta_not_positive", settledIndex: 1 },
    });
  });

  it("flags a resulting != previous + delta", () => {
    const bad: BidLedgerEntry = {
      previousAmountOre: 500,
      deltaOre: 100,
      resultingAmountOre: 999,
      status: "settled",
      settledAt: at(2),
    };
    expect(checkLedgerConsistency([settled(0, 500, 1), bad])).toMatchObject({
      ok: false,
      error: { kind: "arithmetic_mismatch", settledIndex: 1 },
    });
  });

  it("flags a chain break (previous != prior resulting)", () => {
    expect(checkLedgerConsistency([settled(0, 500, 1), settled(700, 100, 2)])).toMatchObject({
      ok: false,
      error: { kind: "chain_break", settledIndex: 1 },
    });
  });
});
