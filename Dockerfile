# syntax=docker/dockerfile:1.7
# One image, two roles (ADR-0002 / ADR-0010 / ADR-0011):
#   web:    node server.js            (Next.js standalone)  <- default CMD
#   worker: node dist/workers/main.js  (tsup bundle)         <- Coolify overrides
# Migrations: Coolify pre-deploy command  `node dist/server/db/migrate.js`
# (bundled; needs only drizzle-orm + postgres + the .sql files in the image).
# Lives at the repo root so Coolify's default Dockerfile detection just works.

# ---- deps ----------------------------------------------------------------
FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build -------------------------------------------------------------
FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1 \
    SKIP_ENV_VALIDATION=1
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# next build (.next/standalone) + tsup (dist/workers/main.js)
RUN pnpm build

# ---- runner ----------------------------------------------------------
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 --ingroup nodejs nextjs

# Next.js standalone server. `pnpm build` runs scripts/prep-standalone.mjs, which
# copies .next/static + public/ into .next/standalone, so this one COPY is
# self-contained for the web role.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./

# Worker bundle + full node_modules (worker-only deps like bullmq aren't traced
# into the standalone output). TODO(perf): slim this to prod deps once the image
# size matters — see BOOTSTRAP.md.
COPY --from=build --chown=nextjs:nodejs /app/dist ./dist
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules

# .sql files for `node dist/server/db/migrate.js` (Coolify pre-deploy)
COPY --from=build --chown=nextjs:nodejs /app/src/server/db/migrations ./src/server/db/migrations
COPY --from=build --chown=nextjs:nodejs /app/package.json ./package.json

USER nextjs
EXPOSE 3000
# Default to the web role; Coolify sets `node dist/workers/main.js` for the worker.
CMD ["node", "server.js"]
