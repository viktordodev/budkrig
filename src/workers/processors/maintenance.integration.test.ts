import { ore } from "@/lib/money";
import type { Clock } from "@/modules/bids/ports";
import { expirePendingBids } from "@/server/db/repositories/bids";
import { createFulfilmentRepository } from "@/server/db/repositories/fulfilment";
import { assertLedger, findUnsettledPaymentIntents } from "@/server/db/repositories/reconcile";
import * as schema from "@/server/db/schema";
import { makeListing, makePendingBid, settlementEvent, stripeEvent } from "@/test/factories";
import { type TestDb, startTestDb } from "@/test/pg";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { processFulfilPayment } from "./fulfil-payment";

const config = { newListingMinOre: ore(500), minIncrementOre: ore(100) };
const at = (iso = "2026-09-04T12:00:00.000Z"): Clock => ({ now: () => new Date(iso) });

let tdb: TestDb;
beforeAll(async () => {
  tdb = await startTestDb();
}, 240_000);
afterAll(async () => {
  await tdb?.close();
});
beforeEach(async () => {
  await tdb.truncateAll();
});

describe("expirePendingBids", () => {
  it("expires old unpaid pending bids + their payments, leaves recent and settled alone", async () => {
    const listing = await makeListing(tdb.db, { status: "pending_payment" });
    const old = await makePendingBid(tdb.db, listing.id, { deltaOre: 500 });
    const fresh = await makePendingBid(tdb.db, listing.id, { deltaOre: 600 });

    // backdate the "old" bid past the TTL
    await tdb.db
      .update(schema.bids)
      .set({ createdAt: new Date("2026-09-01T00:00:00Z") })
      .where(eq(schema.bids.id, old.bid.id));

    const settled = await makePendingBid(tdb.db, listing.id, { deltaOre: 700 });
    await createFulfilmentRepository(tdb.db, config, at()).fulfil(
      settlementEvent(settled, { providerPaymentIntent: "pi_s" }),
    );

    const count = await expirePendingBids(tdb.db, new Date("2026-09-04T00:00:00Z"));
    expect(count).toBe(1);

    const [oldBid] = await tdb.db.select().from(schema.bids).where(eq(schema.bids.id, old.bid.id));
    expect(oldBid?.status).toBe("expired");
    const [oldPay] = await tdb.db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.bidId, old.bid.id));
    expect(oldPay?.status).toBe("expired");

    const [freshBid] = await tdb.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.id, fresh.bid.id));
    expect(freshBid?.status).toBe("pending");
    const [settledBid] = await tdb.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.eventKey, settled.eventKey));
    expect(settledBid?.status).toBe("settled");
  });
});

describe("assertLedger", () => {
  it("returns nothing for a consistent ledger", async () => {
    const listing = await makeListing(tdb.db, { status: "pending_payment", currentAmountOre: 0 });
    const b = await makePendingBid(tdb.db, listing.id, { deltaOre: 500 });
    await createFulfilmentRepository(tdb.db, config, at()).fulfil(
      settlementEvent(b, { providerPaymentIntent: "pi_1" }),
    );

    expect(await assertLedger(tdb.db)).toEqual([]);
  });

  it("flags a listing whose cached amount drifted from the ledger", async () => {
    const listing = await makeListing(tdb.db, { status: "pending_payment", currentAmountOre: 0 });
    const b = await makePendingBid(tdb.db, listing.id, { deltaOre: 500 });
    await createFulfilmentRepository(tdb.db, config, at()).fulfil(
      settlementEvent(b, { providerPaymentIntent: "pi_1" }),
    );

    // corrupt the cache
    await tdb.db
      .update(schema.listings)
      .set({ currentAmountOre: 999 })
      .where(eq(schema.listings.id, listing.id));

    const mismatches = await assertLedger(tdb.db);
    expect(mismatches).toHaveLength(1);
    expect(mismatches[0]).toMatchObject({ cachedAmountOre: 999, ledgerAmountOre: 500 });
  });
});

describe("findUnsettledPaymentIntents", () => {
  it("returns the PIs with no settled bid", async () => {
    const listing = await makeListing(tdb.db, { status: "pending_payment" });
    const b = await makePendingBid(tdb.db, listing.id, { deltaOre: 500 });
    await createFulfilmentRepository(tdb.db, config, at()).fulfil(
      settlementEvent(b, { providerPaymentIntent: "pi_settled" }),
    );

    expect(
      await findUnsettledPaymentIntents(tdb.db, ["pi_settled", "pi_missing", "pi_other"]),
    ).toEqual(["pi_missing", "pi_other"]);
    expect(await findUnsettledPaymentIntents(tdb.db, [])).toEqual([]);
  });
});

describe("processFulfilPayment", () => {
  const payload = (eventKey: string, over: Record<string, unknown> = {}) => ({
    provider: "stripe" as const,
    providerEventId: `evt_${eventKey}`,
    providerPaymentIntent: `pi_${eventKey}`,
    method: "card" as const,
    eventKey,
    type: "checkout.session.completed",
    grossOre: 500,
    vatOre: null,
    vatRate: null,
    taxMode: null,
    countryCode: null,
    payload: { id: "evt" },
    ...over,
  });

  it("settles the bid on the happy path", async () => {
    const listing = await makeListing(tdb.db, { status: "pending_payment", currentAmountOre: 0 });
    const b = await makePendingBid(tdb.db, listing.id, { deltaOre: 500 });

    await processFulfilPayment(payload(b.eventKey), tdb.db);

    const [bid] = await tdb.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.eventKey, b.eventKey));
    expect(bid?.status).toBe("settled");
  });

  it("throws on bid_missing so BullMQ retries", async () => {
    await expect(processFulfilPayment(payload("no-such-bid"), tdb.db)).rejects.toThrow(/no bid/);
  });

  it("does not throw on an anomaly (data problem, not transient)", async () => {
    const listing = await makeListing(tdb.db, { status: "pending_payment" });
    const b = await makePendingBid(tdb.db, listing.id, { deltaOre: 500 });
    // settle it once
    await processFulfilPayment(
      payload(b.eventKey, { providerEventId: "evt_1", providerPaymentIntent: "pi_x" }),
      tdb.db,
    );
    // a different bid re-using pi_x -> pi_conflict anomaly, must not throw
    const other = await makePendingBid(tdb.db, listing.id, { deltaOre: 500 });
    await expect(
      processFulfilPayment(
        payload(other.eventKey, { providerEventId: "evt_2", providerPaymentIntent: "pi_x" }),
        tdb.db,
      ),
    ).resolves.toBeUndefined();
    const [b2] = await tdb.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.eventKey, other.eventKey));
    expect(b2?.status).toBe("pending");
  });
});
