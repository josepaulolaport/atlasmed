# packages/mapbox/AGENTS.md

## Scope

Mapbox API client wrappers: forward/reverse geocoding, matrix, directions. Shared by `apps/api` (facility geocoding) and potentially `apps/web` and `apps/mobile` for map features.

## Rules

- All Mapbox calls go through this package. Do not `fetch("https://api.mapbox.com/...")` from apps.
- Retry with exponential backoff on 5xx and 429.
- Never log the access token.
- Consumers pass token in via factory / env, not via a hardcoded global.
