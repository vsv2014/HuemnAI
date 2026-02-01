# Stage 1: Install dependencies
FROM node:18-alpine AS deps
WORKDIR /app
# Install libc6-compat for some deps if needed
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build the app
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Disable telemetry for build
ENV NEXT_TELEMETRY_DISABLED 1
# Build
RUN npm run build

# Stage 3: Production runner
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build from builder
# Copy public folder for static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
# Ensure hostname is 0.0.0.0 for Docker
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]