# `app/` — routes (thin)

Planned route tree:

```
app/
  [locale]/                     next-intl; sv default, en secondary
    (board)/
      page.tsx                  all-time board (RSC, cache + SWR)
      today/page.tsx            today board
      category/[slug]/page.tsx  category board
    product/[slug]/page.tsx     listing detail (RSC, generateMetadata + JSON-LD)
    claim/page.tsx              claim/raise form (Server Action) + consent step
    manage/page.tsx             magic-link-gated copy editing (ADR-0008)
    about/ rules/ faq/ terms/ privacy/ foretagsinformation/   static
    report/page.tsx             abuse report form
  api/
    webhooks/stripe/route.ts    raw-body signature verify → persist → enqueue → 200
    board/pulse/route.ts        JSON for client polling (ADR-0009)
    activity/stream/route.ts    SSE (post-v1)
    healthz/route.ts  readyz/route.ts
  go/[slug]/route.ts            record click → 302 to target_url (no open redirect)
  sitemap.ts  robots.ts  opengraph-image.tsx
  operator/                     IP/SSO-gated: moderation queue, bull-board, denylist
```

Each route: validate input (Zod) → call a `modules/` function → map the
`Result` to a response/redirect. **No business logic, no SQL, no vendor SDKs.**
