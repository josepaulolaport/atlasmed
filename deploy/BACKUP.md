# Backup Runbook (Uncloud)

The application Postgres database is remote and is not covered by this cluster runbook. Back it up in the provider that hosts it.

## AtlasMed Temporal Postgres

Use `pg_dump` from the VPS host or an attached maintenance container:

```bash
pg_dump -h 127.0.0.1 -U temporal temporal > atlasmed-temporal-$(date +%F-%H%M).sql
```

## Redis

- Redis runs with append-only persistence enabled.
- Back up the `atlasmed_redis_data` volume regularly.
- Copy `/data/appendonly.aof` and snapshots if Redis creates them.

## Meilisearch

- Back up the `atlasmed_meilisearch_data` volume.
- Prefer Meilisearch dumps for portable restore when available.

## MinIO

- Back up the `atlasmed_minio_data` volume.
- `atlasmed-api` creates the configured `STORAGE_BUCKET` on startup, and `atlasmed-cnes-worker` creates the configured `CNES_ARCHIVE_S3_BUCKET` on startup.

## Recommended schedule

- Hourly: Redis AOF copy.
- Daily: Temporal Postgres dump and MinIO volume snapshot.
- Daily or weekly: Meilisearch dump/snapshot, depending on reindex cost.
- Weekly: restore test in a disposable environment.
