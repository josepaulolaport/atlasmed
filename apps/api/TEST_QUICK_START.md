# Test Quick Start ⚡

## TL;DR

```bash
# 1. Setup (once)
cd apps/api
./scripts/setup-test-db.sh

# 2. Run tests
bun run test              # All tests
bun run test:unit         # Fast, no DB
bun run test:integration  # With DB
```

## Requirements

- PostgreSQL on localhost:5432
- Redis on localhost:6379

## Test User

- Email: `test@example.com`
- Password: `Password123!`

## Common Commands

```bash
# Development
bun run test:watch        # Watch mode
bun run test:unit         # Unit tests only (fast)

# Maintenance  
bun run db:seed:test      # Re-seed test data
bun run db:reset:test     # Reset test DB
./scripts/setup-test-db.sh # Full reset

# Check status
cd packages/database && prisma migrate status
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlasmed_test bun prisma studio
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| DB connection error | Start PostgreSQL: `brew services start postgresql` |
| Redis error | Start Redis: `redis-server` |
| No test data | Run: `bun run db:seed:test` |
| Migration error | From `packages/database`: `bun run db:migrate:test` |

## Project Structure

```
apps/api/
├── scripts/setup-test-db.sh  ← Run this first!
├── .env.test                  ← Test config
└── src/
    ├── test-setup.ts          ← Global setup
    └── test-utils/            ← Test helpers
```

## See Also

- Full guide: `TESTING.md`
- Setup details: `../../SETUP_COMPLETE.md`
