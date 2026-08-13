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
- Prefer Meilisearch dumps for portable restore and every cross-version migration. A dump contains all indexes, documents, settings, and completed task history from the instance.
- Snapshots and raw volume copies are version-specific rollback backups; they cannot migrate a v1.13 database to v1.48.
- For the v1.13 to v1.48 production rollout, retain `atlasmed_meilisearch_data` unchanged, import a successful v1.13 dump into the empty `atlasmed_meilisearch_data_v148` volume, and verify all index UIDs before switching production. See `deploy/README.md`.

## Object storage

Cloudflare R2 (`atlasmed-production`), not our volume to back up — durability is
Cloudflare's. The retired `atlasmed_minio_data` volume still holds pre-R2 objects that
nothing references; it needs no backup and can be deleted once nobody wants it.


## Recommended schedule

- Hourly: Redis AOF copy.
- Daily: Temporal Postgres dump. Object storage lives in R2 and needs no volume snapshot.
- Daily or weekly: Meilisearch dump/snapshot, depending on reindex cost.
- Weekly: restore test in a disposable environment.
