# ── Stage 1: Install deps (cached unless package*.json changes) ──
FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/realtime/package.json ./apps/realtime/
RUN npm ci --ignore-scripts

# ── Stage 2: Build (only rebuilds when source changes) ──
FROM deps AS builder
WORKDIR /app
# Copy only what's needed for shared + realtime build
COPY nx.json tsconfig.base.json tsconfig.json ./
COPY packages/shared/ ./packages/shared/
COPY apps/realtime/ ./apps/realtime/
RUN npx nx run shared:build && npx nx run realtime:build

# ── Stage 3: Production image (tiny) ──
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
# Only copy production node_modules and built output
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules 2>/dev/null || true
COPY --from=builder /app/apps/realtime/dist ./dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
EXPOSE 3001
CMD ["node", "dist/main.js"]
