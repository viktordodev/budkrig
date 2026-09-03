"use server";

import { WITHDRAWAL_CONSENT_VERSION } from "@/lib/constants";
import { fromKronor } from "@/lib/money";
import { parseTarget } from "@/lib/target";
import { systemClock } from "@/modules/bids/ports";
import { biddingConfig } from "@/server/config/bidding";
import { env } from "@/server/config/env";
import { db } from "@/server/db/client";
import { createClaimRepository } from "@/server/db/repositories/claim";
import { requestLogger } from "@/server/observability/request-id";
import { createCheckoutSession } from "@/server/payments/stripe";
import { rateLimit } from "@/server/redis/rate-limit";
import { clientIpFromHeaders, hashIp } from "@/server/security/ip";
import { nanoid } from "nanoid";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

export type ClaimState =
  | { readonly status: "idle" }
  | {
      readonly status: "error";
      readonly message: string;
      readonly fieldErrors?: Record<string, string>;
    };

const Schema = z.object({
  target: z.string().trim().min(1).max(300),
  category: z.string().min(1),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(280),
  email: z.string().email(),
  amountKr: z.coerce.number().int().positive().max(999_999),
  consent: z.string().optional(),
  locale: z.enum(["sv", "en"]).catch("sv"),
});

export async function submitClaim(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const log = await requestLogger();

  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      fieldErrors[key] ??= issue.message;
    }
    return { status: "error", message: "Kontrollera fälten.", fieldErrors };
  }
  const data = parsed.data;

  if (data.consent !== "on") {
    return {
      status: "error",
      message: "Du måste godkänna villkoren.",
      fieldErrors: { consent: "required" },
    };
  }

  const requestHeaders = await headers();
  const ipHash = hashIp(clientIpFromHeaders(requestHeaders));
  const limit = await rateLimit(`claim:${ipHash}`, { limit: 5, windowSec: 600 });
  if (!limit.ok) {
    return { status: "error", message: "För många försök. Försök igen om en stund." };
  }

  const target = parseTarget(data.target);
  if (!target.ok) {
    return {
      status: "error",
      message: "Ogiltig URL eller @handle.",
      fieldErrors: { target: target.error.kind },
    };
  }

  const eventKey = nanoid();
  const claimRepo = createClaimRepository(db, biddingConfig, systemClock);
  const result = await claimRepo.createPendingBid({
    slug: target.value.slug,
    kind: target.value.kind,
    targetUrl: target.value.targetUrl,
    title: data.title,
    description: data.description,
    categorySlug: data.category,
    ownerEmail: data.email,
    targetAmountOre: fromKronor(data.amountKr),
    clientIpHash: ipHash,
    eventKey,
    withdrawalConsentVersion: WITHDRAWAL_CONSENT_VERSION,
  });

  if (!result.ok) {
    const error = result.error;
    if (error.kind === "below_minimum") {
      const kr = Math.ceil(error.requiredOre / 100);
      return {
        status: "error",
        message: `Minsta belopp för den här platsen är ${kr} kr.`,
        fieldErrors: { amountKr: "för lågt" },
      };
    }
    if (error.kind === "unknown_category") {
      return { status: "error", message: "Välj en giltig kategori." };
    }
    return { status: "error", message: "Den här listningen kan inte längre ändras." };
  }

  let checkoutUrl: string | null;
  try {
    const session = await createCheckoutSession({
      bidId: result.value.bidId,
      eventKey,
      listingSlug: result.value.listingSlug,
      amountOre: result.value.deltaOre,
      isNewListing: result.value.isNewListing,
      customerEmail: data.email,
      locale: data.locale,
      successUrl: `${env.APP_URL}/klar?session={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${env.APP_URL}/claim`,
    });
    checkoutUrl = session.url;
  } catch (err) {
    log.error({ err: String(err), bidId: result.value.bidId }, "checkout session creation failed");
    return { status: "error", message: "Betalningen kunde inte startas. Försök igen senare." };
  }

  if (!checkoutUrl) {
    return { status: "error", message: "Betalningen kunde inte startas. Försök igen senare." };
  }
  redirect(checkoutUrl);
}
