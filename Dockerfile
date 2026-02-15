# ─── Stage 1: Build ───
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for prisma generate)
RUN npm ci

# Generate Prisma client
COPY prisma.config.js ./
RUN npx prisma generate

# ─── Stage 2: Production ───
FROM node:20-alpine AS production

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeapp -u 1001 -G nodejs

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy generated Prisma client from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy application code
COPY prisma ./prisma/
COPY prisma.config.js ./
COPY server.js ./
COPY src ./src/

# Create directories for uploads and logs
RUN mkdir -p public/avatars logs && \
    chown -R nodeapp:nodejs /app

USER nodeapp

# Environment
ENV NODE_ENV=production
ENV PORT=3069

EXPOSE 3069

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3069/health || exit 1

# Use dumb-init for proper PID 1 signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "--import=extensionless/register", "server.js"]
