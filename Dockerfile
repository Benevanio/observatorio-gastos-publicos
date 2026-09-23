# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build Frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /build/frontend

COPY frontend/package*.json ./

RUN npm ci --legacy-peer-deps

COPY frontend/ .

RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Build Backend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS backend-builder

# Prisma 5 precisa do OpenSSL para executar corretamente no Alpine
RUN apk add --no-cache openssl

WORKDIR /build/backend

COPY backend/package*.json ./

RUN npm ci --legacy-peer-deps

COPY backend/ .

# Gera o Prisma Client usando a versão definida no package.json/package-lock.json
RUN npx prisma generate

RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 3: Production
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Dependências necessárias em runtime:
# - netcat: health/wait PostgreSQL
# - openssl: Prisma
RUN apk add --no-cache \
    netcat-openbsd \
    openssl

WORKDIR /app

# ─── Backend dependencies ────────────────────────────────────────────────────
COPY backend/package*.json ./backend/

WORKDIR /app/backend

# Prisma está em dependencies porque o entrypoint executa migrations em runtime
RUN npm ci --omit=dev --legacy-peer-deps

# ─── Backend build ───────────────────────────────────────────────────────────
COPY --from=backend-builder /build/backend/dist ./dist

# Prisma schema + migrations
COPY --from=backend-builder /build/backend/prisma ./prisma

# Prisma Client gerado
COPY --from=backend-builder /build/backend/node_modules/.prisma ./node_modules/.prisma

# ─── Frontend build ──────────────────────────────────────────────────────────
COPY --from=frontend-builder /build/frontend/dist /app/frontend/dist

# ─── Entrypoint ──────────────────────────────────────────────────────────────
WORKDIR /app

COPY docker-entrypoint.sh ./

RUN chmod +x docker-entrypoint.sh

EXPOSE 3001

HEALTHCHECK \
    --interval=15s \
    --timeout=5s \
    --start-period=30s \
    --retries=5 \
    CMD wget -qO- http://localhost:3001/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]