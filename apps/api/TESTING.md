# Testing Guide

This guide explains how to run tests and set up your test environment for the AtlasMed API.

## Prerequisites

1. **PostgreSQL** - Running on localhost:5432
2. **Redis** - Running on localhost:6379
3. **Test Database** - Create a separate database for tests

## Initial Setup

### Quick Setup (Recommended)

Run the automated setup script:

```bash
cd apps/api
./scripts/setup-test-db.sh
```

This script will:
- Check PostgreSQL and Redis connections
- Create the test database (or recreate if exists)
- Run all migrations from `packages/database`
- Seed test data
- Verify everything is ready

### Manual Setup

If you prefer to set up manually:

#### 1. Create Test Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create test database
CREATE DATABASE atlasmed_test;

# Exit psql
\q
```

#### 2. Run Test Migrations

**Important:** Migrations must be run from the `packages/database` directory:

```bash
cd apps/api

# Run migrations on test database
bun run db:migrate:test
```

Or manually:

```bash
cd packages/database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlasmed_test prisma migrate deploy
```

#### 3. Seed Test Database

```bash
cd apps/api

# Seed with test data (creates test user and roles)
bun run db:seed:test
```

## Running Tests

### Run All Tests

```bash
cd apps/api
bun run test
```

### Run Only Unit Tests

```bash
# Excludes integration tests that need database
bun run test:unit
```

### Run Only Integration Tests

```bash
# Runs tests that interact with database/redis
bun run test:integration
```

### Watch Mode

```bash
# Re-run tests on file changes
bun run test:watch
```

### Run Specific Test File

```bash
bun test src/modules/access/application/services/session.service.test.ts
```

### Run Tests Matching Pattern

```bash
bun test --test-name-pattern="LoginUseCase"
```

## Test Database Management

### Reset Test Database

```bash
# Warning: This will delete all data and re-run migrations
bun run db:reset:test

# Then re-seed
bun run db:seed:test
```

### View Test Database

```bash
# Connect to test database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/atlasmed_test bun run db:studio
```

## Test Environment Variables

Tests use `.env.test` file which contains:

- `DATABASE_URL` - Points to `atlasmed_test` database
- `REDIS_URL` - Uses Redis DB 1 (separate from dev DB 0)
- Mock credentials for external services (Resend, Twilio)

## Test Data

The test seed creates:

- **3 Roles**: ADMIN, MANAGER, USER
- **1 Test User**:
  - Email: `test@example.com`
  - Username: `testuser`
  - Password: `Password123!`
  - Role: USER
  - Status: ACTIVE

Use this test user for integration tests that need authentication.

## Test Structure

```
apps/api/src/
├── modules/
│   └── access/
│       ├── application/
│       │   ├── services/          # Service tests
│       │   └── use-cases/         # Use case tests
│       ├── infrastructure/
│       │   ├── repositories/      # Repository tests
│       │   └── middleware/        # Middleware tests
│       └── test-helpers/          # Mock factories
├── infrastructure/
│   └── database/
│       ├── seed.ts               # Production seed
│       └── test-seed.ts          # Test seed
├── test-setup.ts                 # Global test setup
└── test-utils/                   # Test utilities
    └── mock-reset.ts             # Mock cleanup helpers
```

## Writing Tests

### Unit Tests

Use mock factories from `test-helpers/fixtures.ts`:

```typescript
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
    // Always clean up mocks to prevent test interference
    resetAllMocks(mockUserRepo, mockSessionRepo);
  });

  it("should do something", async () => {
    // Your test here
  });
});
```

### Integration Tests

Integration tests use the actual database and are marked with "Integration Tests" in the name:

```typescript
import { prisma } from "../../../../infrastructure/database/prisma.client";

describe("My Integration Tests", () => {
  // This test will use the real test database
  it("should work with database", async () => {
    const user = await prisma.user.findFirst();
    expect(user).toBeDefined();
  });
});
```

## Troubleshooting

### Tests Fail with Database Errors

**Problem**: `Cannot find table "User"` or similar

**Solution**: Run migrations on test database:
```bash
bun run db:migrate:test
bun run db:seed:test
```

### Tests Fail with "User not found"

**Problem**: Integration tests can't find test user

**Solution**: Re-seed test database:
```bash
bun run db:seed:test
```

### Test Interference Issues

**Problem**: Tests pass individually but fail when run together

**Solutions**:
1. Ensure you're using `afterEach` to clean up mocks
2. Don't use global state or singletons in tests
3. Use `createMock*` factories for fresh mocks in each test

### Redis Connection Errors

**Problem**: `Redis connection refused`

**Solution**: 
1. Ensure Redis is running: `redis-cli ping`
2. Check Redis URL in `.env.test`
3. Tests use Redis DB 1, dev uses DB 0

### Slow Tests

**Problem**: Tests take a long time

**Solution**:
- Run only unit tests: `bun run test:unit`
- Unit tests are fast (no DB), integration tests are slower

## CI/CD

For CI environments, ensure:

1. PostgreSQL and Redis are available
2. Create test database in CI setup
3. Run migrations from packages/database and seed before tests:

```yaml
# Example GitHub Actions
- name: Setup PostgreSQL
  uses: ikalnytskyi/action-setup-postgres@v4
  
- name: Setup Redis
  uses: shogo82148/actions-setup-redis@v1
  
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

### Alternative: Use Setup Script in CI

```yaml
- name: Setup Test Environment
  run: cd apps/api && ./scripts/setup-test-db.sh <<< "n"
  
- name: Run Tests
  run: cd apps/api && bun run test
```

## Best Practices

1. **Isolate Tests**: Each test should be independent
2. **Clean Up**: Use `afterEach` to reset mocks
3. **Mock External Services**: Don't call real APIs in tests
4. **Meaningful Names**: Use descriptive test names
5. **Test One Thing**: Each test should verify one behavior
6. **Arrange-Act-Assert**: Structure tests clearly
7. **Fast Tests**: Unit tests should be < 50ms
8. **Reliable**: Tests shouldn't be flaky

## Performance Tips

- Use `test:unit` for quick feedback during development
- Run integration tests before committing
- Mock external dependencies (Redis, Email, SMS) in unit tests
- Keep integration tests focused and minimal
