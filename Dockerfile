# syntax=docker/dockerfile:1

# Stage 1: Base image with Node.js 24 and pnpm
FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@11.24.0
WORKDIR /app

# Stage 2: Workspace dependency installation
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/domain/package.json ./packages/domain/
RUN pnpm install --frozen-lockfile

# Stage 3: Build packages and Next.js standalone application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app ./
COPY tsconfig.base.json ./
COPY packages/domain ./packages/domain
COPY packages/db ./packages/db
COPY apps/web ./apps/web

# Dummy build-time environment variables for Next.js build evaluation
ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV BETTER_AUTH_SECRET="build-time-placeholder-secret-32-chars-minimum"
ENV BETTER_AUTH_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_URL="http://localhost:3000"

RUN mkdir -p /app/apps/web/public
RUN pnpm --filter @nodvis/finance-web build

# Stage 4: Controlled Drizzle migration runner (uses committed SQL in packages/db/drizzle)
FROM base AS migrator
WORKDIR /app
COPY --from=deps --chown=node:node /app ./
COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node packages/domain ./packages/domain
COPY --chown=node:node packages/db ./packages/db

USER node
CMD ["pnpm", "--filter", "@nodvis/finance-db", "db:migrate"]

# Stage 5: Production runner for Next.js standalone web service
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Copy standalone server build, static assets, and localization messages
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/messages ./apps/web/messages

USER nextjs

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
