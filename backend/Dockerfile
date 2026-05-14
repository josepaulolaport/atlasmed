# Backend Dockerfile for Uncloud deployment
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun run --bun fetch http://localhost:3001/health || exit 1

# Start the application
CMD ["bun", "run", "index.ts"]
