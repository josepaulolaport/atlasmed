# 🚀 QuestDB Installation Instructions

## What is QuestDB?

QuestDB is a high-performance time-series database perfect for storing API logs, metrics, and traces. It gives you:

- **Persistent Storage** - Keep logs after restarts
- **Fast Queries** - Sub-second SQL queries on millions of rows
- **SQL Interface** - Familiar query language
- **Low Resource Usage** - Efficient storage and memory

---

## Installation Steps

### Step 1: Install QuestDB Client Library

```bash
cd atlasmed/apps/api
bun add @questdb/nodejs-client pg
```

This will install:
- `@questdb/nodejs-client` - Fast ingestion via InfluxDB line protocol
- `pg` - PostgreSQL driver for queries (QuestDB is PostgreSQL-compatible)

### Step 2: Start QuestDB

```bash
cd atlasmed
docker-compose -f docker-compose.observability.yml up -d questdb

# Verify it's running
docker ps | grep questdb

# Check logs
docker logs atlasmed-questdb
```

You should see:
```
QuestDB server started successfully
Web console: http://localhost:9000
PostgreSQL wire: 0.0.0.0:8812
InfluxDB line protocol: 0.0.0.0:9009
```

### Step 3: Create Tables

**Option A: Via Web UI** (Recommended)

1. Open http://localhost:9000
2. Copy the contents of `questdb-init.sql`
3. Paste into the SQL editor
4. Click "Run"

**Option B: Via HTTP API**

```bash
# Run the initialization script
cat questdb-init.sql | while IFS= read -r line; do
  if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*-- ]]; then
    curl -G "http://localhost:9000/exec" --data-urlencode "query=$line"
  fi
done
```

### Step 4: Enable in .env

Edit `atlasmed/apps/api/.env`:

```bash
# Find this section and update:
QUESTDB_ENABLED=true
QUESTDB_HOST=localhost
QUESTDB_PORT=9009
```

### Step 5: Restart API

```bash
cd atlasmed/apps/api
bun run dev
```

Look for this log message:
```
QuestDB logger connected
```

### Step 6: Test It

```bash
# Make a request
curl http://localhost:3000/api/v1/access/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@atlasmed.com","password":"password"}'

# Check QuestDB
open http://localhost:9000

# Run query:
SELECT * FROM api_logs ORDER BY timestamp DESC LIMIT 10;
```

You should see your request logged!

---

## ✅ Verification Checklist

- [ ] QuestDB client installed (`@questdb/nodejs-client` and `pg`)
- [ ] QuestDB container running
- [ ] Tables created (check http://localhost:9000)
- [ ] `.env` updated with `QUESTDB_ENABLED=true`
- [ ] API restarted
- [ ] "QuestDB logger connected" appears in logs
- [ ] Test request appears in `api_logs` table

---

## 🎨 Optional: Add Grafana

For beautiful dashboards:

```bash
# Start Grafana
docker-compose -f docker-compose.observability.yml up -d grafana

# Open Grafana
open http://localhost:3300

# Login
# Username: admin
# Password: admin

# Add QuestDB datasource:
# 1. Go to Configuration → Data Sources
# 2. Click "Add data source"
# 3. Select "PostgreSQL"
# 4. Configure:
#    - Name: QuestDB
#    - Host: questdb:8812
#    - Database: qdb
#    - User: admin
#    - Password: quest
#    - SSL Mode: disable
# 5. Click "Save & Test"

# Now create dashboards with your logs!
```

---

## 🐛 Troubleshooting

### Issue: Cannot connect to QuestDB

**Check if running:**
```bash
docker ps | grep questdb
```

**Check logs:**
```bash
docker logs atlasmed-questdb
```

**Restart:**
```bash
docker-compose -f docker-compose.observability.yml restart questdb
```

### Issue: Package not found

Make sure you're in the API directory:
```bash
cd atlasmed/apps/api
bun add @questdb/nodejs-client pg
```

### Issue: Tables don't exist

Re-run the initialization script:
```bash
# Open http://localhost:9000
# Copy/paste questdb-init.sql content
# Click "Run"
```

Or check table existence:
```sql
SHOW TABLES;
```

### Issue: API can't connect

Check environment variables:
```bash
# In apps/api/.env
QUESTDB_ENABLED=true
QUESTDB_HOST=localhost  # Use 'questdb' if API is in Docker
QUESTDB_PORT=9009
```

Restart API after changes:
```bash
bun run dev
```

---

## 📊 What You Get

After installation, every API request is automatically logged to QuestDB with:

- Request ID (for tracing)
- User ID (if authenticated)
- HTTP method and route
- Status code
- Response time
- Error details (if any)
- Full context

Query it with SQL:

```sql
-- Recent requests
SELECT * FROM api_logs 
ORDER BY timestamp DESC 
LIMIT 100;

-- Error rate
SELECT 
  route,
  COUNT(*) as total,
  SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as errors
FROM api_logs
WHERE timestamp > dateadd('h', -1, now())
GROUP BY route;

-- Slow queries
SELECT * FROM api_logs 
WHERE duration_ms > 1000 
ORDER BY duration_ms DESC;
```

---

## 🛑 Stopping QuestDB

```bash
# Stop all observability services
docker-compose -f docker-compose.observability.yml down

# Stop but keep data
docker-compose -f docker-compose.observability.yml stop

# Start again
docker-compose -f docker-compose.observability.yml up -d
```

---

## 📚 Next Steps

1. **Explore**: Play with SQL queries in http://localhost:9000
2. **Dashboards**: Set up Grafana for visualization
3. **Alerts**: Create alerts based on query results
4. **Production**: Deploy QuestDB to production

See full documentation:
- [QUESTDB_SETUP.md](./apps/api/QUESTDB_SETUP.md) - Complete guide
- [QUESTDB_QUICK_START.md](./QUESTDB_QUICK_START.md) - Quick reference

---

**Status:** Ready to install  
**Time:** 10 minutes  
**Benefit:** Persistent observability data with powerful SQL queries
