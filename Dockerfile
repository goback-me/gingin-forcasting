# syntax=docker/dockerfile:1.4

# Using Debian (slim) rather than Alpine -- Prisma's OpenSSL/platform
# detection has repeated, well-documented problems on Alpine's musl libc
# (both the query engine used by @prisma/client, and the separate schema
# engine used by the `prisma` CLI for migrations). Debian sidesteps the
# whole class of issue. Bigger image, far fewer surprises.

# --- deps: install once, cached separately from source changes ---
# Deliberately does NOT copy prisma/ and does NOT run postinstall's
# `prisma generate` -- that keeps this layer's cache key to ONLY
# package.json/package-lock.json, so editing schema.prisma (which happens
# constantly on this project) no longer forces a full npm ci re-run.
# `toolchain` below runs `prisma generate` properly once real source exists.
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

# --- toolchain: full source + generated Prisma client, NO Next.js build ---
# This is what the `migrate` service (docker-compose.prod.yml) targets --
# migrations and one-off import scripts need the Prisma CLI and the app's
# lib/ code, but never the compiled Next.js app. Previously `migrate`
# targeted `builder` (below), which meant every single migration or import
# run also triggered a full `npm run build` for no reason -- that was the
# actual cause of "everything takes forever," not the build itself being
# slow.
FROM node:20-slim AS toolchain
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate

# --- builder: compile the app -- only the `app` service needs this ---
FROM toolchain AS builder
# NEXT_PUBLIC_* vars get compiled directly into the client-side JS bundle
# by `next build` -- they have to exist as real env vars at BUILD time,
# not just passed to the running container later (that's too late, the
# bundle's already been produced). See docker-compose.prod.yml's
# build.args for where these actually come from.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
RUN mkdir -p public
RUN --mount=type=cache,target=/app/.next/cache npm run build

# --- runner: the actual image that ships, just the standalone output ---
FROM node:20-slim AS runner
WORKDIR /app
RUN apt-get update && apt-get install -y openssl gosu && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production

RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Deliberately NOT switching to `USER nextjs` here -- the entrypoint needs
# to start as root to fix /app/data's ownership (see docker-entrypoint.sh),
# then drops to nextjs itself via gosu before actually running the app.
EXPOSE 3000
ENV PORT=3000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]