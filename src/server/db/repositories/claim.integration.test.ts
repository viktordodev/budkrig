import { ore } from "@/lib/money";
import type { Clock } from "@/modules/bids/ports";
import * as schema from "@/server/db/schema";
import { claimInput, makeListing, seedCategory } from "@/test/factories";
import { type TestDb, startTestDb } from "@/test/pg";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createClaimRepository } from "./claim";

const config = { newListingMinOre: ore(500), minIncrementOre: ore(100) };
const at = (iso = "2026-09-03T12:00:00.000Z"): Clock => ({ now: () => new Date(iso) });

let tdb: TestDb;

beforeAll(async () => {
  tdb = await startTestDb();
}, 240_000);
afterAll(async () => {
  await tdb?.close();
});
beforeEach(async () => {
  await tdb.truncateAll();
  await seedCategory(tdb.db, "ovrigt");
});

describe("claim repository — createPendingBid", () => {
  it("creates a pending listing + bid + payment for a new slug", async () => {
    const repo = createClaimRepository(tdb.db, config, at());
    const input = claimInput({ slug: "nyprodukt.se", targetAmountOre: ore(500) });

    const result = await repo.createPendingBid(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      deltaOre: 500,
      isNewListing: true,
      listingSlug: "nyprodukt.se",
    });

    const [l] = await tdb.db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.slug, "nyprodukt.se"));
    expect(l?.status).toBe("pending_payment");
    expect(l?.currentAmountOre).toBe(0);

    const [b] = await tdb.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.eventKey, input.eventKey));
    expect(b?.status).toBe("pending");
    expect(b?.deltaOre).toBe(500);
    expect(b?.previousAmountOre).toBeNull();
    expect(b?.withdrawalConsentVersion).toBe("test-consent-v1");
    expect(b?.withdrawalConsentAt?.toISOString()).toBe("2026-09-03T12:00:00.000Z");

    const [p] = await tdb.db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.bidId, b?.id ?? ""));
    expect(p).toMatchObject({ status: "pending", amountOre: 500, currency: "SEK" });
  });

  it("raises an existing active listing without touching it", async () => {
    const listing = await makeListing(tdb.db, {
      slug: "aktiv.se",
      status: "active",
      currentAmountOre: 12_000,
      firstActiveAt: new Date("2026-08-01T00:00:00Z"),
    });
    const repo = createClaimRepository(tdb.db, config, at());

    const result = await repo.createPendingBid(
      claimInput({ slug: "aktiv.se", targetAmountOre: ore(15_000) }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      deltaOre: 3_000,
      isNewListing: false,
      listingId: listing.id,
    });

    const [l] = await tdb.db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.id, listing.id));
    expect(l?.status).toBe("active");
    expect(l?.currentAmountOre).toBe(12_000);
  });

  it("rejects a target below the minimum", async () => {
    const repo = createClaimRepository(tdb.db, config, at());
    const result = await repo.createPendingBid(claimInput({ targetAmountOre: ore(400) }));
    expect(result).toEqual({ ok: false, error: { kind: "below_minimum", requiredOre: 500 } });
    const bids = await tdb.db.select().from(schema.bids);
    expect(bids).toHaveLength(0);
  });

  it("rejects an unknown category", async () => {
    const repo = createClaimRepository(tdb.db, config, at());
    const result = await repo.createPendingBid(claimInput({ categorySlug: "does-not-exist" }));
    expect(result).toEqual({ ok: false, error: { kind: "unknown_category" } });
  });

  it("rejects a removed listing", async () => {
    await makeListing(tdb.db, { slug: "borttagen.se", status: "removed", currentAmountOre: 900 });
    const repo = createClaimRepository(tdb.db, config, at());
    const result = await repo.createPendingBid(
      claimInput({ slug: "borttagen.se", targetAmountOre: ore(2_000) }),
    );
    expect(result).toEqual({ ok: false, error: { kind: "listing_removed" } });
  });

  it("handles concurrent claims for the same new slug — one listing, two bids", async () => {
    const repo = createClaimRepository(tdb.db, config, at());
    const [r1, r2] = await Promise.all([
      repo.createPendingBid(claimInput({ slug: "kapplopning.se", targetAmountOre: ore(500) })),
      repo.createPendingBid(claimInput({ slug: "kapplopning.se", targetAmountOre: ore(600) })),
    ]);
    expect(r1.ok && r2.ok).toBe(true);

    const listings = await tdb.db
      .select()
      .from(schema.listings)
      .where(eq(schema.listings.slug, "kapplopning.se"));
    expect(listings).toHaveLength(1);

    const bids = await tdb.db
      .select()
      .from(schema.bids)
      .where(eq(schema.bids.listingId, listings[0]?.id ?? ""));
    expect(bids).toHaveLength(2);
    expect(bids.every((b) => b.status === "pending")).toBe(true);
  });
});
