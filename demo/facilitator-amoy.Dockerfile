FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies
COPY demo/a2a/facilitator-amoy/package*.json ./
RUN npm ci --omit=dev

# Copy source and build (if ts build exists)
COPY demo/a2a/facilitator-amoy/ .
RUN if [ -f package.json ] && grep -q "build" package.json; then npm run build || true; fi

# Runtime image
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app .
EXPOSE 5401
CMD ["node", "dist/index.js"] 