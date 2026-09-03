# syntax=docker/dockerfile:1.7
# One image, two roles (ADR-0002 / ADR-0010 / ADR-0011):
#   web:    node server.js          (Next.js standalone)
#   worker: node dist/workers/main.js
# The start command is set per-service in Coolify.

# ---- deps ------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- build ---------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Builds .next/standalone (web) and dist/ (worker) — see package.json "build".
RUN pnpm build

# ---- runner ------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Next.js standalone server + static assets + public dir
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Worker bundle + its runtime deps (node_modules carried by standalone tracing
# does not include worker-only deps, so copy the full prod node_modules subset)
COPY --from=build --chown=nextjs:nodejs /app/dist ./dist
COPY --from=deps  --chown=nextjs:nodejs /app/node_modules ./node_modules

# Drizzle migrations run as a Coolify pre-deploy step; keep the CLI + files here.
COPY --from=build --chown=nextjs:nodejs /app/src/server/db/migrations ./src/server/db/migrations
COPY --from=build --chown=nextjs:nodejs /app/drizzle.config.ts ./drizzle.config.ts

USER nextjs
EXPOSE 3000
# Default to the web role; Coolify overrides for the worker service.
CMD ["node", "server.js"]
