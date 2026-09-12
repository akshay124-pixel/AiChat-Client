# ── Production Dockerfile (used by docker-compose.dev.yml runner / serve) ────
# NOTE: For Vercel, this file is NOT used — Vercel builds directly from source.
#       This Dockerfile is only for self-hosting the built frontend.

# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

# Build-time API URL — override with --build-arg VITE_API_BASE_URL=https://...
ARG VITE_API_BASE_URL=http://localhost:8000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

RUN npm install -g serve@14 && addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=builder /app/dist ./dist
USER appuser

EXPOSE 4173
CMD ["serve", "-s", "dist", "-l", "4173", "--no-clipboard"]
