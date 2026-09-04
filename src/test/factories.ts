import { randomUUID } from "node:crypto";
import { type Ore, ore } from "@/lib/money";
import type { ClaimInput, SettledPaymentEvent } from "@/modules/bids/ports";
import type { ListingStatus } from "@/modules/bids/types";
import * as schema from "@/server/db/schema";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

type Db = PostgresJsDatabase<typeof schema>;

function first<T>(rows: T[], what: string): T {
  const row = rows[0];
  if (row === undefined) throw new Error(`factory: expected a ${what} row`);
  return row;
}

export async function seedCategory(db: Db, slug = "ovrigt") {
  const inserted = await db
    .insert(schema.categories)
    .values({ slug, nameSv: slug, nameEn: slug })
    .onConflictDoNothing({ target: schema.categories.slug })
    .returning();
  if (inserted[0]) return inserted[0];
  return first(
    await db.select().from(schema.categories).where(eq(schema.categories.slug, slug)),
    "category",
  );
}

export async function makeListing(
  db: Db,
  over: {
    slug?: string;
    status?: ListingStatus;
    currentAmountOre?: number;
    firstActiveAt?: Date | null;
    categorySlug?: string;
  } = {},
) {
  const category = await seedCategory(db, over.categorySlug ?? "ovrigt");
  return first(
    await db
      .insert(schema.listings)
      .values({
        slug: over.slug ?? `listing-${randomUUID().slice(0, 8)}`,
        kind: "url",
        targetUrl: "https://example.com",
        title: "Test listing",
        description: "A test listing.",
        categoryId: category.id,
        currentAmountOre: over.currentAmountOre ?? 0,
        status: over.status ?? "pending_payment",
        ownerEmail: "test@budkrig.se",
        firstActiveAt: over.firstActiveAt ?? null,
      })
      .returning(),
    "listing",
  );
}

export async function makePendingBid(
  db: Db,
  listingId: string,
  over: { deltaOre?: number; eventKey?: string } = {},
) {
  const eventKey = over.eventKey ?? `evt-key-${randomUUID()}`;
  const deltaOre = over.deltaOre ?? 500;

  const bid = first(
    await db
      .insert(schema.bids)
      .values({ listingId, deltaOre, status: "pending", eventKey })
      .returning(),
    "bid",
  );
  const payment = first(
    await db
      .insert(schema.payments)
      .values({
        bidId: bid.id,
        provider: "stripe",
        amountOre: deltaOre,
        currency: "SEK",
        status: "pending",
      })
      .returning(),
    "payment",
  );
  return { bid, payment, eventKey, deltaOre };
}

export function claimInput(over: Partial<ClaimInput> = {}): ClaimInput {
  const targetAmountOre: Ore = over.targetAmountOre ?? ore(500);
  return {
    slug: over.slug ?? `claim-${randomUUID().slice(0, 8)}.se`,
    kind: over.kind ?? "url",
    targetUrl: over.targetUrl ?? "https://claim.example",
    title: over.title ?? "A claimed listing",
    description: over.description ?? "Claimed in a test.",
    categorySlug: over.categorySlug ?? "ovrigt",
    ownerEmail: over.ownerEmail ?? "owner@example.com",
    targetAmountOre,
    clientIpHash: over.clientIpHash ?? "iphash",
    eventKey: over.eventKey ?? `evt-key-${randomUUID()}`,
    withdrawalConsentVersion: over.withdrawalConsentVersion ?? "test-consent-v1",
  };
}

export function stripeEvent(
  eventKey: string,
  over: Partial<SettledPaymentEvent> = {},
): SettledPaymentEvent {
  return {
    provider: "stripe",
    providerEventId: over.providerEventId ?? `evt_${randomUUID()}`,
    providerPaymentIntent: over.providerPaymentIntent ?? `pi_${randomUUID().slice(0, 16)}`,
    method: over.method ?? "card",
    eventKey,
    type: over.type ?? "checkout.session.completed",
    grossOre: over.grossOre ?? 0,
    vatOre: over.vatOre ?? null,
    vatRate: over.vatRate ?? null,
    taxMode: over.taxMode ?? null,
    countryCode: over.countryCode ?? null,
    payload: over.payload ?? { id: "evt_test", object: "event" },
  };
}

/** A settled event whose gross matches the pending bid's delta — the happy case. */
export function settlementEvent(
  pending: { eventKey: string; deltaOre: number },
  over: Partial<SettledPaymentEvent> = {},
): SettledPaymentEvent {
  return stripeEvent(pending.eventKey, { grossOre: pending.deltaOre, ...over });
}
