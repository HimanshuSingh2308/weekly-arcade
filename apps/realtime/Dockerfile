# ── Stage 1: Install deps + build ──
FROM node:20-slim AS builder
WORKDIR /app

# Copy root package files
COPY package.json package-lock.json nx.json tsconfig.base.json tsconfig.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/realtime/package.json ./apps/realtime/

# Install all deps
RUN npm ci --ignore-scripts

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/realtime/ ./apps/realtime/

# Sync nx and build
RUN npx nx sync --yes 2>/dev/null; npx nx run shared:build && npx nx run realtime:build

# ── Stage 2: Production image (tiny) ──
FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy node_modules and built output
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/realtime/dist ./dist
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

EXPOSE 8080
CMD ["node", "dist/main.js"]
