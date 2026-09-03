# 0003 — PostgreSQL with Drizzle ORM

- Status: Accepted
- Date: 2026-09-03
- Deciders: Viktor

## Context

The data is small and highly relational: listings, an append‑only bid ledger,
payments, categories, webhook events. The hard requirements are **transactional
integrity** (N1), **row‑level locking** for fulfilment (N3, ADR‑0005),
**exact‑integer money** (ADR‑0004), and **cheap self‑hosting** (ADR‑0011). We
also want gap‑free sequential invoice numbers (ADR‑0007). Volume is tiny;
correctness and operability dominate.

## Decision

- **PostgreSQL 16**, self‑hosted as a Coolify managed service.
- **Drizzle ORM** for schema definition, typed queries and migrations.
- Schema is code (`src/server/db/schema.ts`); migrations are generated SQL
  files committed to the repo and applied as a release step (`drizzle-kit`).
- Use real Postgres features where they earn their place: `numeric`/`bigint`
  for money, `citext` for email, partial + composite indexes for the board,
  `SELECT ... FOR UPDATE` for fulfilment, a DB sequence for invoice numbers,
  `LISTEN/NOTIFY` for the SSE activity feed later (ADR‑0009).
- The app connects as a **least‑privilege role** (DML + limited DDL for
  migrations via a separate migration role).

## Consequences

### Positive
- ACID transactions and row locks are exactly the primitives the money model
  needs — no application‑level lock service.
- Drizzle is a thin, SQL‑shaped layer: generated SQL migrations we can read and
  review, no hidden query behaviour, small runtime, first‑class TypeScript
  types from the schema.
- One database engine to operate, back up and restore (N6).
- Postgres scales vertically far past anything this product will need.

### Negative / accepted trade‑offs
- Drizzle's migration story is less "magic" than Prisma Migrate — we manage the
  expand/contract discipline ourselves (documented in conventions). Acceptable;
  we want that control near the money.
- Fewer batteries than Prisma (no built‑in studio parity, seed framework). Minor.
- Team must be comfortable reading SQL. Expected for this project.

### Follow‑ups
- Define the two DB roles and connection strings in `.env.example`.
- Set `statement_timeout`, `idle_in_transaction_session_timeout`, and a sane
  pool ceiling (the app must not exhaust connections during a spike, N4).
- Write the seed script (categories + a demo listing).
- Add the hourly `assert-ledger` reconciliation job (core‑flows Flow 5).

## Alternatives considered

- **Prisma** — great DX, but heavier client, historically weaker raw‑SQL/locking
  ergonomics, and we value readable migrations near the money path. Close call;
  either would work. Drizzle wins on transparency + footprint.
- **SQLite / Turso / LiteFS** — tempting for a solo project, but concurrent
  write correctness under a spike and the backup/replication story are riskier
  for a payments ledger.
- **Supabase (hosted Postgres)** — pulls hosting off Coolify and adds a
  subprocessor + data‑residency question (R9). We want Postgres, self‑hosted.
- **A document store (Mongo/Dynamo)** — the data is relational and needs
  multi‑row transactions; wrong tool.
