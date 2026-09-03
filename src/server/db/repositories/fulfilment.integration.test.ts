import { ore } from "@/lib/money";
import {
  type BidLedgerEntry,
  checkLedgerConsistency,
  currentAmountFromLedger,
} from "@/modules/bids/ledger";
import type { Clock } from "@/modules/bids/ports";
import * as schema from "@/server/db/schema";
import { makeListing, makePendingBid, stripeEvent } from "@/test/factories";
import { type TestDb, startTestDb } from "@/test/pg";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createFulfilmentRepository } from "./fulfilment";

const config = { newListingMinOre: ore(500), minIncrementOre: ore(100) };
const at = (iso = "2026-09-03T12:00:00.000Z"): Clock => ({ now: () => new Date(iso) });

const toLedger = (rows: (typeof schema.bids.$inferSelect)[]): BidLedgerEntry[] =>
  rows.map((r) => ({
    previousAmountOre: r.previousAmountOre ?? 0,
    deltaOre: r.deltaOre,
    resultingAmountOre: r.resultingAmountOre ?? 0,
    status: r.status,
    settledAt: r.settledAt,
  }));

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

describe("fulfilment repository", () => {
  it("activates a brand-new listing on first settlement", async () => {
    const listing = await makeListing(tdb.db, { status: "pending_payment", currentAmountOre: 0 });
    const { eventKey } = await makePendingBid(tdb.db, listing.id, { deltaOre: 500 });
    const repo = createFulfilmentRepository(tdb.db, config, at());

    const decision = await repo.fulfil(stripeEvent(eventKey, { providerPaymentIntent: "pi_1" }));
    expect(decision.kind).toBe("proceed");

    const [l] = await tdb.db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, listing.id));
    expect(l?.status).toBe("active");
    expect(l?.currentAmountOre).toBe(500);
    expect(l?.firstActiveAt).not.toBeNull();

    const [b] = await tdb.db.select().from(schema.bids).where(eq(schema.bids.eventKey, eventKey));
    expect(b?.status).toBe("settled");
    expect(b?.previousAmountOre).toBe(0);
    expect(b?.resultingAmountOre).toBe(500);
    expect(b?.providerPaymentIntent).toBe("pi_1");

    const [p] = await tdb.db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.bidId, b?.id ?? ""));
    expect(p?.status).toBe("settled");
    expect(p?.method).toBe("card");
  });

  it("is idempotent on the webhook event id — replay is a no-op", async () => {
    const listing = await makeListing(tdb.db, { status: "pending_payment" });
    const { eventKey } = await makePendingBid(tdb.db, listing.id, { deltaOre: 700 });
    const repo = createFulfilmentRepository(tdb.db, config, at());
    const event = stripeEvent(eventKey, {
      providerEventId: "evt_same",
      providerPaymentIntent: "pi_x",
    });

    const first = await repo.fulfil(event);
    const second = await repo.fulfil(event);

    expect(first.kind).toBe("proceed");
    expect(second).toEqual({ kind: "skip", reason: "webhook_replayed" });

    const bids = await tdb.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.listingId, listing.id));
    expect(bids).toHaveLength(1);
    const [l] = await tdb.db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, listing.id));
    expect(l?.currentAmountOre).toBe(700);
  });

  it("is idempotent on a re-delivered payment — new event id, same bid + payment_intent", async () => {
    const listing = await makeListing(tdb.db, { status: "pending_payment" });
    const { eventKey } = await makePendingBid(tdb.db, listing.id, { deltaOre: 700 });
    const repo = createFulfilmentRepository(tdb.db, config, at());

    await repo.fulfil(
      stripeEvent(eventKey, { providerEventId: "evt_1", providerPaymentIntent: "pi_same" }),
    );
    const second = await repo.fulfil(
      stripeEvent(eventKey, { providerEventId: "evt_2", providerPaymentIntent: "pi_same" }),
    );

    expect(second).toEqual({ kind: "skip", reason: "already_settled" });
    const [l] = await tdb.db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, listing.id));
    expect(l?.currentAmountOre).toBe(700);
  });

  it("serialises concurrent settlements on the SAME listing — no lost update", async () => {
    const listing = await makeListing(tdb.db, { status: "pending_payment", currentAmountOre: 0 });
    const a = await makePendingBid(tdb.db, listing.id, { deltaOre: 300 });
    const b = await makePendingBid(tdb.db, listing.id, { deltaOre: 500 });
    const repo = createFulfilmentRepository(tdb.db, config, at());

    const [da, dbn] = await Promise.all([
      repo.fulfil(stripeEvent(a.eventKey, { providerPaymentIntent: "pi_a" })),
      repo.fulfil(stripeEvent(b.eventKey, { providerPaymentIntent: "pi_b" })),
    ]);
    expect(da.kind).toBe("proceed");
    expect(dbn.kind).toBe("proceed");

    const [l] = await tdb.db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, listing.id));
    expect(l?.currentAmountOre).toBe(800);

    const bids = await tdb.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.listingId, listing.id));
    const ledger = toLedger(bids);
    expect(checkLedgerConsistency(ledger)).toEqual({ ok: true, value: undefined });
    expect(currentAmountFromLedger(ledger)).toBe(800);
  });

  it("survives many concurrent settlements on one listing", async () => {
    const listing = await makeListing(tdb.db, { status: "pending_payment", currentAmountOre: 0 });
    const deltas = [100, 100, 100, 100, 100, 250, 250, 300];
    const bids = await Promise.all(
      deltas.map((deltaOre) => makePendingBid(tdb.db, listing.id, { deltaOre })),
    );
    const repo = createFulfilmentRepository(tdb.db, config, at());

    await Promise.all(
      bids.map((x, i) =>
        repo.fulfil(stripeEvent(x.eventKey, { providerPaymentIntent: `pi_${i}` })),
      ),
    );

    const [l] = await tdb.db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, listing.id));
    expect(l?.currentAmountOre).toBe(deltas.reduce((s, d) => s + d, 0));

    const rows = await tdb.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.listingId, listing.id));
    expect(checkLedgerConsistency(toLedger(rows))).toEqual({ ok: true, value: undefined });
  });

  it("runs settlements on DIFFERENT listings independently", async () => {
    const l1 = await makeListing(tdb.db, { status: "pending_payment", currentAmountOre: 0 });
    const l2 = await makeListing(tdb.db, { status: "pending_payment", currentAmountOre: 0 });
    const b1 = await makePendingBid(tdb.db, l1.id, { deltaOre: 600 });
    const b2 = await makePendingBid(tdb.db, l2.id, { deltaOre: 900 });
    const repo = createFulfilmentRepository(tdb.db, config, at());

    await Promise.all([
      repo.fulfil(stripeEvent(b1.eventKey, { providerPaymentIntent: "pi_1" })),
      repo.fulfil(stripeEvent(b2.eventKey, { providerPaymentIntent: "pi_2" })),
    ]);

    const [r1] = await tdb.db.select().from(schema.listings).where(eq(schema.listings.id, l1.id));
    const [r2] = await tdb.db.select().from(schema.listings).where(eq(schema.listings.id, l2.id));
    expect(r1?.currentAmountOre).toBe(600);
    expect(r2?.currentAmountOre).toBe(900);
  });

  it("adds the delta on top of the listing's current amount", async () => {
    const listing = await makeListing(tdb.db, {
      status: "active",
      currentAmountOre: 2_000,
      firstActiveAt: new Date("2026-08-01T00:00:00Z"),
    });
    const { eventKey } = await makePendingBid(tdb.db, listing.id, { deltaOre: 200 });
    const repo = createFulfilmentRepository(tdb.db, config, at());

    await repo.fulfil(stripeEvent(eventKey, { providerPaymentIntent: "pi_1" }));

    const [b] = await tdb.db.select().from(schema.bids).where(eq(schema.bids.eventKey, eventKey));
    expect(b?.previousAmountOre).toBe(2_000);
    expect(b?.resultingAmountOre).toBe(2_200);
    const [l] = await tdb.db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, listing.id));
    expect(l?.currentAmountOre).toBe(2_200);
    expect(l?.firstActiveAt?.toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("records the bid + payment but does not un-hide a hidden listing", async () => {
    const listing = await makeListing(tdb.db, {
      status: "hidden",
      currentAmountOre: 5_000,
      firstActiveAt: new Date("2026-08-01T00:00:00Z"),
    });
    const { eventKey } = await makePendingBid(tdb.db, listing.id, { deltaOre: 500 });
    const repo = createFulfilmentRepository(tdb.db, config, at());

    await repo.fulfil(stripeEvent(eventKey, { providerPaymentIntent: "pi_1" }));

    const [l] = await tdb.db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, listing.id));
    expect(l?.status).toBe("hidden");
    expect(l?.currentAmountOre).toBe(5_500);
    const [b] = await tdb.db.select().from(schema.bids).where(eq(schema.bids.eventKey, eventKey));
    expect(b?.status).toBe("settled");
  });

  it("rejects a second settled bid re-using a payment_intent", async () => {
    const l1 = await makeListing(tdb.db, { status: "pending_payment" });
    const l2 = await makeListing(tdb.db, { status: "pending_payment" });
    const b1 = await makePendingBid(tdb.db, l1.id, { deltaOre: 500 });
    const b2 = await makePendingBid(tdb.db, l2.id, { deltaOre: 500 });
    const repo = createFulfilmentRepository(tdb.db, config, at());

    await repo.fulfil(stripeEvent(b1.eventKey, { providerPaymentIntent: "pi_shared" }));
    const second = await repo.fulfil(
      stripeEvent(b2.eventKey, {
        providerEventId: "evt_dup_pi",
        providerPaymentIntent: "pi_shared",
      }),
    );

    expect(second).toMatchObject({ kind: "anomaly", reason: "pi_conflict" });
    const [b] = await tdb.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.eventKey, b2.eventKey));
    expect(b?.status).toBe("pending");
  });

  it("skips when no bid exists yet and leaves the event unprocessed for retry", async () => {
    const repo = createFulfilmentRepository(tdb.db, config, at());
    const decision = await repo.fulfil(
      stripeEvent("evt-key-orphan", {
        providerEventId: "evt_orphan",
        providerPaymentIntent: "pi_o",
      }),
    );
    expect(decision).toEqual({ kind: "skip", reason: "bid_missing" });

    const [w] = await tdb.db
      .select()
      .from(schema.webhookEvents)
      .where(eq(schema.webhookEvents.providerEventId, "evt_orphan"));
    expect(w?.processedAt).toBeNull();
  });
});
