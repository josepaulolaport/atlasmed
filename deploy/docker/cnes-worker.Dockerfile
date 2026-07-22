FROM oven/bun:1.3.14 AS prepare

WORKDIR /app
COPY . .

RUN bunx turbo prune @atlasmed/cnes-ingestion-worker --docker

FROM oven/bun:1.3.14 AS runtime

WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 unzip \
  && rm -rf /var/lib/apt/lists/*
COPY --from=prepare /app/out/json/ ./
RUN for i in 1 2 3; do bun install --frozen-lockfile --ignore-scripts && exit 0; echo "bun install failed (attempt $i), retrying..."; sleep 5; done; exit 1
COPY --from=prepare /app/out/full/ ./

ENV NODE_ENV=production

ENTRYPOINT ["bun", "apps/workers/cnes-ingestion/src/worker.ts"]
