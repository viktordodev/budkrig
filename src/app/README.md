# `app/` — routes (thin)

**i18n:** no URL locale prefix in v1. Swedish is the default; English via the
`NEXT_LOCALE` cookie (see `src/server/config/i18n.ts`). If SEO later needs `/en`
paths, add next-intl routing + middleware + a `[locale]` segment then.

## Current (Milestone 1)

```
app/
  layout.tsx           root — <html lang>, NextIntlClientProvider, metadata
  page.tsx             home = the board (reads DB, degrades gracefully)
  globals.css          Tailwind v4 entry + theme tokens
  healthz/route.ts     liveness (no dependencies)
  readyz/route.ts      readiness (DB + Redis) — Coolify gates deploys on this
```

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
