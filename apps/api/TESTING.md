# Testing Guide

Full testing procedures — setup, run modes, troubleshooting, CI — live in the skill:

**→ `skills/procedure/run-api-tests/SKILL.md`**

Any AI or developer running or writing api tests should load that skill.

## Quick reference

- Automated setup: `cd apps/api && ./scripts/setup-test-db.sh`
- Run all: `bun run test`
- Unit only: `bun run test:unit`
- Integration only: `bun run test:integration`
- Watch: `bun run test:watch`

Test user: `test@example.com` / `Password123!` / role `USER`.

Env: `.env.test` — `atlasmed_test` DB, Redis DB 1, mocked Resend/Twilio.
