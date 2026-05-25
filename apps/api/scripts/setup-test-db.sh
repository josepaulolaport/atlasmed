#!/bin/bash

# Setup Test Database Script
# This script creates and sets up the test database for running tests

set -e  # Exit on error

echo "🔧 Setting up test database..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="atlasmed_test"
DB_USER="postgres"
DB_PASSWORD="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Check if PostgreSQL is running
echo "📡 Checking PostgreSQL connection..."
if ! psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "SELECT 1" > /dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to PostgreSQL${NC}"
    echo "Please ensure PostgreSQL is running on $DB_HOST:$DB_PORT"
    echo "User: $DB_USER"
    exit 1
fi
echo -e "${GREEN}✓${NC} PostgreSQL is running"
echo ""

# Check if test database exists
echo "🗄️  Checking test database..."
if psql -U $DB_USER -h $DB_HOST -p $DB_PORT -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo -e "${YELLOW}⚠️  Test database '$DB_NAME' already exists${NC}"
    read -p "Do you want to recreate it? This will DELETE all data. (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Dropping existing database..."
        psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "DROP DATABASE $DB_NAME;" || true
        echo -e "${GREEN}✓${NC} Database dropped"
    else
        echo "Skipping database creation..."
        echo ""
        echo "📝 Running migrations on existing database..."
        cd ../../packages/database
        DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" bun prisma migrate deploy
        cd ../../apps/api
        echo -e "${GREEN}✓${NC} Migrations complete"
        
        echo ""
        echo "🌱 Seeding test database..."
        DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" bun src/infrastructure/database/test-seed.ts
        echo ""
        echo -e "${GREEN}✅ Test database is ready!${NC}"
        exit 0
    fi
fi

# Create test database
echo "Creating test database '$DB_NAME'..."
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "CREATE DATABASE $DB_NAME;"
echo -e "${GREEN}✓${NC} Database created"
echo ""

# Run migrations
echo "📝 Running migrations..."
cd ../../packages/database
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" bun prisma migrate deploy
cd ../../apps/api
echo -e "${GREEN}✓${NC} Migrations complete"
echo ""

# Seed database
echo "🌱 Seeding test database..."
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" bun src/infrastructure/database/test-seed.ts
echo ""

# Check Redis
echo "📡 Checking Redis connection..."
if redis-cli -n 1 ping > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Redis is running (using DB 1 for tests)"
else
    echo -e "${YELLOW}⚠️  Redis is not running${NC}"
    echo "Tests using Redis will fail. Start Redis with: redis-server"
fi
echo ""

echo -e "${GREEN}✅ Test environment setup complete!${NC}"
echo ""
echo "📚 Next steps:"
echo "  1. Run all tests:         bun run test"
echo "  2. Run unit tests only:   bun run test:unit"
echo "  3. Run integration tests: bun run test:integration"
echo ""
echo "Test database credentials:"
echo "  URL: postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
echo "  User: test@example.com"
echo "  Password: Password123!"
echo ""
