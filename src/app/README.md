# `app/` — routes (thin)

**i18n:** no URL locale prefix in v1. Swedish is the default; English via the
`NEXT_LOCALE` cookie (see `src/server/config/i18n.ts`). If SEO later needs `/en`
paths, add next-intl routing + middleware + a `[locale]` segment then.

## Current

```
app/
  layout.tsx                    root — <html lang>, NextIntlClientProvider, metadata
  page.tsx                      home = the board (ISR revalidate 5s + Redis query cache)
  globals.css                   Tailwind v4 entry + theme tokens
  healthz/ readyz/              liveness / readiness (Coolify)
  claim/
    page.tsx  claim-form.tsx  actions.ts   claim/raise → Stripe Checkout (Flow 1a)
  go/[slug]/route.ts            outbound click → 302 (records a click, no open redirect)
  api/webhooks/stripe/route.ts  verify → normalize → enqueue (BullMQ) → 200
  (legal)/terms|privacy|foretagsinformation/   draft legal pages (src/content/legal.ts)
```

Root `layout.tsx` renders `<SiteFooter>` (legal links + "paid placement, not
endorsed" disclaimer) on every page.

## Planned

```
app/
  (board)/today/page.tsx
  category/[slug]/page.tsx
  product/[slug]/page.tsx     generateMetadata + JSON-LD
  claim/page.tsx              claim/raise form (Server Action) + consent step
  manage/page.tsx             magic-link-gated copy editing (ADR-0008)
  about/ rules/ faq/ terms/ privacy/ foretagsinformation/   static
  report/page.tsx
  api/
    webhooks/stripe/route.ts  raw-body verify → persist → enqueue → 200
    board/pulse/route.ts      JSON for client polling (ADR-0009)
    activity/stream/route.ts  SSE (post-v1)
  go/[slug]/route.ts          record click → 302 to target_url (no open redirect)
  sitemap.ts  robots.ts  opengraph-image.tsx
  operator/                   IP/SSO-gated: moderation queue, bull-board, denylist
```

Each route: validate input (Zod) → call a `modules/` function → map the
`Result` to a response/redirect. **No business logic, no SQL, no vendor SDKs.**
