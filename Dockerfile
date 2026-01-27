# ---- Dependencies Stage ----
FROM node:24-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm ci && npm cache clean --force

# ---- Build Stage ----
FROM node:24-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y git curl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Accept build arguments for NEXT_PUBLIC_ variables
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ARG NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_RUM_APP_MONITOR_ID
ARG NEXT_PUBLIC_AWS_REGION
ARG NEXT_PUBLIC_RUM_IDENTITY_POOL_ID

# Set environment variables from build args (needed for Next.js build)
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_RUM_APP_MONITOR_ID=$NEXT_PUBLIC_RUM_APP_MONITOR_ID
ENV NEXT_PUBLIC_AWS_REGION=$NEXT_PUBLIC_AWS_REGION
ENV NEXT_PUBLIC_RUM_IDENTITY_POOL_ID=$NEXT_PUBLIC_RUM_IDENTITY_POOL_ID

ENV NODE_ENV=production
ENV NEXT_OUTPUT=standalone
RUN npm run build

# ---- Production Stage ----
FROM node:24-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install Playwright system dependencies + Chromium
RUN apt-get update && apt-get install -y \
    postgresql-client \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

ENV HOME=/home/nextjs

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy build output
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/src/db/migrations ./src/db/migrations

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/scripts/migrate.ts ./scripts/migrate.ts
COPY --from=builder /app/scripts/seed.ts ./scripts/seed.ts

# Install production dependencies (includes playwright)
COPY --from=builder /app/package-lock.json ./package-lock.json
RUN npm ci --omit=dev && npm cache clean --force

# Install Playwright Chromium browser
RUN npx playwright install --with-deps chromium \
    && chown -R nextjs:nodejs /home/nextjs/.cache

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run migrations then start the server
CMD ["sh", "-c", "node --experimental-strip-types scripts/migrate.ts && node server.js"]
