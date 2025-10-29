# Multi-stage build for production
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN pnpm build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package*.json ./
COPY pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db ./src/db

# Create data directory for SQLite
RUN mkdir -p /data && chown -R node:node /data

# Switch to non-root user
USER node

# SQLite database will be stored in persistent volume
VOLUME ["/data"]

# Environment variables
ENV STORAGE_DIR=/data
ENV NODE_ENV=production

# Expose port (optional, for future REST API)
EXPOSE 3000

# Run the MCP server
CMD ["node", "dist/index.js"]

