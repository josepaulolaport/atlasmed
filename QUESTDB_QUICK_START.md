# 🚀 QuestDB Quick Start (5 Minutes)

Add persistent storage for all your API logs and metrics!

## Step 1: Install QuestDB Client

```bash
cd atlasmed/apps/api
bun add @questdb/nodejs-client pg
```

## Step 2: Start QuestDB

```bash
cd atlasmed
docker-compose -f docker-compose.observability.yml up -d questdb

# Check it's running
docker ps | grep questdb
```

## Step 3: Create Tables

Open QuestDB UI: http://localhost:9000

Copy and paste the contents of `questdb-init.sql` into the SQL editor and run it.

Or run from terminal:

```bash
cat questdb-init.sql | curl -G http://localhost:9000/exec --data-urlencode "query=$(cat questdb-init.sql)"
```

## Step 4: Enable in .env

```bash
# Edit apps/api/.env
QUESTDB_ENABLED=true
QUESTDB_HOST=localhost
QUESTDB_PORT=9009
```

## Step 5: Restart API

```bash
cd apps/api
bun run dev
```

## Step 6: Test It

```bash
# Make some requests
curl http://localhost:3000/api/v1/access/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@atlasmed.com","password":"password"}'

# Check QuestDB
open http://localhost:9000

# Run query:
SELECT * FROM api_logs ORDER BY timestamp DESC LIMIT 10;
```

## ✅ What You Get

- All requests logged to QuestDB
- Persistent storage (keeps data after restart)
- SQL queries for analysis
- Fast performance (sub-second queries)
- Automatic route sanitization (IDs replaced with :id)

## 📊 Useful Queries

```sql
-- Recent requests
SELECT * FROM api_logs ORDER BY timestamp DESC LIMIT 100;

-- Error rate
SELECT 
  route,
  COUNT(*) as total,
  SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as error_rate
FROM api_logs
WHERE timestamp > dateadd('h', -1, now())
GROUP BY route;

-- Slow requests
SELECT * FROM api_logs 
WHERE duration_ms > 1000 
ORDER BY duration_ms DESC 
LIMIT 20;

-- Requests per minute
SELECT 
  timestamp_floor('m', timestamp) as minute,
  COUNT(*) as requests
FROM api_logs
WHERE timestamp > dateadd('h', -1, now())
SAMPLE BY 1m;
```

## 🎓 Optional: Add Grafana

```bash
# Start Grafana
docker-compose -f docker-compose.observability.yml up -d grafana

# Open Grafana
open http://localhost:3300
# Login: admin/admin

# Add QuestDB datasource:
# - Type: PostgreSQL
# - Host: questdb:8812
# - Database: qdb
# - User: admin
# - Password: quest
```

## 🛑 Stop Everything

```bash
docker-compose -f docker-compose.observability.yml down
```

## 📚 Full Documentation

See [QUESTDB_SETUP.md](./apps/api/QUESTDB_SETUP.md) for:
- Advanced queries
- Production setup
- Data retention
- Performance tuning
- Troubleshooting

---

**Status:** ✅ Ready to use  
**Time:** 5 minutes  
**Benefit:** Persistent observability data with SQL queries
