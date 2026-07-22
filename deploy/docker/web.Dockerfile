FROM oven/bun:1.3.14 AS prepare

WORKDIR /app
COPY . .

RUN bunx turbo prune @atlasmed/web --docker

FROM oven/bun:1.3.14 AS installer

WORKDIR /app
COPY --from=prepare /app/out/json/ ./
RUN for i in 1 2 3; do bun install --frozen-lockfile --ignore-scripts && exit 0; echo "bun install failed (attempt $i), retrying..."; sleep 5; done; exit 1
COPY --from=prepare /app/out/full/ ./
COPY --from=prepare /app/tsconfig.base.json ./tsconfig.base.json

FROM installer AS builder

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN bunx turbo run build --filter=@atlasmed/web

FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

WORKDIR /app/apps/web

EXPOSE 3000

ENTRYPOINT ["node", "server.js"]
