# Testing Guide

## Prerequisites
- PostgreSQL running on `localhost:5432`.
- Redis running on `localhost:6379`.
- Separate `atlasmed_test` database (created below).

## Setup

### Automated (recommended)

```bash
cd apps/api
./scripts/setup-test-db.sh
```

Script performs: connection checks → creates/recreates `atlasmed_test` → runs migrations from `packages/database` → seeds test data → verifies.

### Manual

```bash
# 1. Create test database
psql -U postgres
CREATE DATABASE atlasmed_test;
\q

# 2. Migrations
cd apps/api && bun run db:migrate:test
# or explicit:
cd packages/database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlasmed_test prisma migrate deploy

# 3. Seed
cd apps/api && bun run db:seed:test
```

## Running

| Command | Purpose |
|---|---|
| `cd apps/api && bun run test` | All tests |
| `bun run test:unit` | Unit only (no DB) |
| `bun run test:integration` | Integration only (with DB) |
| `bun run test:watch` | Re-run on file change |
| `bun test <file>` | Specific file |
| `bun test --test-name-pattern="LoginUseCase"` | Pattern match |

## Test database management

```bash
# Reset (deletes data, re-runs migrations)
bun run db:reset:test
bun run db:seed:test

# View
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlasmed_test bun run db:studio
```

## Test environment (`.env.test`)

- `DATABASE_URL` → `atlasmed_test`.
- `REDIS_URL` → Redis DB 1 (dev uses DB 0).
- Mock credentials for Resend / Twilio.

## Seed data

Test seed creates:
- Roles: `ADMIN`, `MANAGER`, `USER`.
- Test user: `test@example.com` / `testuser` / `Password123!` / role USER / status ACTIVE.

Use this user for integration tests needing auth.

## Test structure

```
apps/api/src/
├── modules/<domain>/
│   ├── application/
│   │   ├── services/     # service tests
│   │   └── use-cases/    # use-case tests
│   ├── infrastructure/
│   │   ├── repositories/ # repo tests
│   │   └── middleware/   # middleware tests
│   └── test-helpers/     # mock factories
├── infrastructure/database/
│   ├── seed.ts           # production seed
│   └── test-seed.ts      # test seed
├── test-setup.ts         # global test setup
└── test-utils/
    └── mock-reset.ts     # mock cleanup helpers
```

## Writing unit tests

Use mock factories from `test-helpers/fixtures.ts`. Always reset mocks in `afterEach`:

```ts
import { createMockUserRepository, createMockSessionRepository } from "../../test-helpers/fixtures";
import { resetAllMocks } from "../../../../test-utils/mock-reset";

describe("MyService", () => {
  let mockUserRepo: UserRepository;
  let mockSessionRepo: SessionRepository;

  beforeEach(() => {
    mockUserRepo = createMockUserRepository();
    mockSessionRepo = createMockSessionRepository();
  });

  afterEach(() => {
    resetAllMocks(mockUserRepo, mockSessionRepo);
  });
});
```

## Writing integration tests

Live database. Filename convention: `<module>-http.integration.test.ts` (colocated with the module).

```ts
import { prisma } from "../../../../infrastructure/database/prisma.client";

describe("My Integration Tests", () => {
  it("should work with database", async () => {
    const user = await prisma.user.findFirst();
    expect(user).toBeDefined();
  });
});
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find table "User"` | `bun run db:migrate:test` then `bun run db:seed:test` |
| "User not found" in integration test | `bun run db:seed:test` |
| Tests pass alone, fail together | Missing `afterEach` mock cleanup; remove global state/singletons; use fresh `createMock*` per test |
| `Redis connection refused` | Ensure Redis running (`redis-cli ping`); check `.env.test`; tests use DB 1 |
| Slow suite | Use `bun run test:unit` during dev; integration is slower |

## CI

Ensure PostgreSQL + Redis available, create test DB, migrate, seed, then test. Sketch:

```yaml
- name: Setup Test Database
  run: |
    createdb atlasmed_test
    cd packages/database
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlasmed_test bun prisma migrate deploy
    cd ../../apps/api
    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlasmed_test bun src/infrastructure/database/test-seed.ts
- name: Run Tests
  run: cd apps/api && bun run test
```

Or reuse the script:
```yaml
- run: cd apps/api && ./scripts/setup-test-db.sh <<< "n"
- run: cd apps/api && bun run test
```

## Rules

- Every test isolated. No cross-test global state.
- `afterEach` resets mocks.
- No real external APIs in tests — Resend/Twilio always mocked.
- Unit tests <50ms; integration slower but focused.
- Arrange-Act-Assert structure.
- Descriptive names; one behavior per test.
