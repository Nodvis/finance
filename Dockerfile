# syntax=docker/dockerfile:1
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@11.24.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/domain/package.json ./packages/domain/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app ./
COPY tsconfig.base.json ./
COPY packages/domain ./packages/domain
COPY packages/db ./packages/db
COPY apps/web ./apps/web
ARG VERSION=0.2.1
ENV NODE_ENV=production
ENV NEXT_PUBLIC_APP_VERSION=$VERSION
RUN mkdir -p /app/apps/web/public
RUN DATABASE_URL="postgresql://build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-only-placeholder-not-a-runtime-secret" \
    pnpm --filter @nodvis/finance-web build

FROM node:24-alpine AS runner
ARG VERSION=0.2.1
WORKDIR /app
ENV NODE_ENV=production PORT=3990 HOSTNAME="0.0.0.0" NEXT_PUBLIC_APP_VERSION=$VERSION
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
LABEL org.opencontainers.image.title="Nodvis Finance" \
      org.opencontainers.image.description="Self-hosted household finance control center" \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.source="https://github.com/Nodvis/finance" \
      org.opencontainers.image.url="https://github.com/Nodvis/finance" \
      org.opencontainers.image.licenses="AGPL-3.0-only"
COPY --from=builder --chown=nextjs:nodejs /app/packages/domain ./packages/domain
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/drizzle ./drizzle
COPY --chown=nextjs:nodejs scripts/database-url.mjs scripts/migrate.mjs scripts/validate-runtime-config.mjs scripts/docker-entrypoint.sh ./scripts/
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/messages ./apps/web/messages
RUN npm install --no-save --omit=dev --no-package-lock drizzle-orm@0.45.2 pg@8.23.0
USER nextjs
EXPOSE 3990
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
