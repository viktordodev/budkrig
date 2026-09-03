# 0009 — Near‑real‑time via revalidation + polling + SSE; defer websockets

- Status: Accepted
- Date: 2026-09-03
- Deciders: Viktor

## Context

The board feels alive: amounts change, a "latest activity" feed ticks, an
"online now" count. But the read path must survive a 100× spike on one VPS
(N4), and a solo operator does not want to run and scale a stateful websocket
tier. How "real‑time" does this actually need to be? Ranks change on the order
of seconds‑to‑minutes, not milliseconds.

## Decision

Three mechanisms, cheapest first:

1. **Server render + HTTP caching + on‑demand revalidation.** Board and listing
   pages are Server Components with `s-maxage` + `stale-while-revalidate`.
   Fulfilment (Flow 1b) does **targeted** revalidation of the affected board /
   category / listing paths and clears the matching Redis cache keys. Most
   visitors see a page that's at most a few seconds stale — fine.
2. **Client polling for the volatile bits.** The claim widget's "your live
   position", the "latest activity" list, and counters poll a small JSON
   endpoint (`GET /api/board/pulse?…`) every 3–5 s, backed by a short‑TTL Redis
   cache so 5,000 pollers cost ~1 query per TTL window. Polling backs off when
   the tab is hidden.
3. **SSE for the activity feed (post‑v1).** A single `GET /api/activity/stream`
   Server‑Sent Events endpoint fed by Postgres `LISTEN/NOTIFY` → one listener
   per web process fanning out to connected clients. One‑way, rides normal
   HTTP, no extra infra. Added when polling load or "liveness feel" justifies
   it.

**Websockets are explicitly deferred** until there's a feature that needs
bidirectional or sub‑second updates (there isn't one in scope).

## Consequences

### Positive
- The read path is cache‑served and spike‑resistant by construction (N4).
- Polling cost is bounded by TTL, not by user count.
- SSE (when added) needs no new service, no sticky sessions, no scaling tier.
- Degradation is graceful: if revalidation lags, users see a slightly stale
  board, not an error.

### Negative / accepted trade‑offs
- Updates are seconds‑stale, not instant. Acceptable for this product; the
  claim screen shows a fresh position on each poll and always re‑validates at
  payment time (ADR‑0005) so nobody pays on bad data.
- Polling is "wasteful" in theory. In practice, with a short‑TTL cache it's a
  handful of DB queries per second regardless of traffic, and far simpler than
  a WS tier.
- SSE holds a connection per viewer of the feed; capped and shed under load,
  and only for users actually watching the feed.

### Follow‑ups
- Define the `pulse` payload (top‑N, viewer's listing position, activity tail,
  counters) and its Redis key + TTL.
- Cache‑invalidation helper used by the worker; test that fulfilment refreshes
  the right keys/paths.
- Presence ("online now"): approximate via Redis (rolling set of hashed
  session ids with TTL), not exact. Post‑v1.
- Load test: 5k pollers + concurrent claims, assert DB query rate stays flat.

## Alternatives considered

- **Websockets (Socket.IO / a Bun WS server / Pusher‑style)** — real infra,
  scaling, sticky sessions or a pub/sub backplane, for updates that don't need
  to be instant. Deferred.
- **Poll with no cache** — DB load scales linearly with viewers; dies in a
  spike. Rejected.
- **Fully static ISR only, no polling** — the claim screen would show stale
  positions and the product would feel dead during the moments that matter.
- **Third‑party realtime (Ably/Pusher/Supabase Realtime)** — a subprocessor +
  cost + data‑residency question (R9) for a deferrable feature.
