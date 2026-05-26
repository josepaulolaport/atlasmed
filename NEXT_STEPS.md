# ✅ Next Steps - QuestDB Setup

## Current Status
✅ QuestDB client installed  
✅ Code compiled successfully  
⏳ Ready to start QuestDB

---

## Step 1: Start QuestDB (1 minute)

```bash
cd /Users/josepaulolaport/Documents/projects/atlasmed

# Start QuestDB
docker-compose -f docker-compose.observability.yml up -d questdb

# Verify it's running (wait 10 seconds for startup)
sleep 10
docker ps | grep questdb

# You should see:
# atlasmed-questdb ... Up ... 0.0.0.0:9000->9000/tcp, 0.0.0.0:8812->8812/tcp, 0.0.0.0:9009->9009/tcp
```

---

## Step 2: Create Database Tables (2 minutes)

### Option A: Via Web UI (Recommended)

```bash
# Open QuestDB UI
open http://localhost:9000
```

Then:
1. Click on the **SQL Editor** (Console tab)
2. Copy ALL the contents from `questdb-init.sql` file
3. Paste into the editor
4. Click **Run**
5. You should see: "CREATE TABLE" success messages

### Option B: Via Command Line

```bash
# Create tables automatically
cat questdb-init.sql | while IFS= read -r line; do
  if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*-- ]]; then
    curl -G "http://localhost:9000/exec" --data-urlencode "query=$line" 2>/dev/null
  fi
done
```

### Verify Tables Created

In QuestDB UI, run:
```sql
SHOW TABLES;
```

You should see:
- `api_logs`
- `api_metrics`
- `db_queries`

---

## Step 3: Enable QuestDB in .env (30 seconds)

```bash
cd apps/api

# Edit .env file - change this line:
# From: QUESTDB_ENABLED=false
# To:   QUESTDB_ENABLED=true
```

Or use this command:
```bash
sed -i '' 's/QUESTDB_ENABLED=false/QUESTDB_ENABLED=true/' .env
```

---

## Step 4: Restart API (30 seconds)

```bash
cd apps/api

# Stop if running (Ctrl+C)
# Then start:
bun run dev
```

Look for this log message:
```
QuestDB logger connected
```

If you see that, you're ready! 🎉

---

## Step 5: Test It! (1 minute)

### Make a Test Request

```bash
# In a new terminal:
curl http://localhost:3000/api/v1/access/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@atlasmed.com","password":"password"}'
```

### Check QuestDB

1. Go to: http://localhost:9000
2. In the SQL editor, run:

```sql
SELECT * FROM api_logs ORDER BY timestamp DESC LIMIT 10;
```

You should see your request logged!

Example output:
```
level | method | route                  | status_code | duration_ms | request_id
------|--------|------------------------|-------------|-------------|------------
info  | POST   | /api/v1/access/login  | 200         | 45          | 550e8400-...
```

---

## 🎉 You're Done!

Now every API request is automatically logged to QuestDB with:
- Request ID
- User ID (if authenticated)
- Method and route
- Status code
- Response time
- Error details (if any)

---

## 🔍 Try Some Queries

### Recent Requests
```sql
SELECT * FROM api_logs 
ORDER BY timestamp DESC 
LIMIT 100;
```

### Error Rate
```sql
SELECT 
  route,
  COUNT(*) as total,
  SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as error_rate
FROM api_logs
WHERE timestamp > dateadd('h', -1, now())
GROUP BY route;
```

### Slow Requests
```sql
SELECT * FROM api_logs 
WHERE duration_ms > 1000 
ORDER BY duration_ms DESC 
LIMIT 20;
```

### Requests Per Minute
```sql
SELECT 
  timestamp_floor('m', timestamp) as minute,
  COUNT(*) as requests
FROM api_logs
WHERE timestamp > dateadd('h', -1, now())
SAMPLE BY 1m;
```

---

## 🎨 Optional: Add Grafana (5 minutes)

Want beautiful dashboards?

```bash
# Start Grafana
docker-compose -f docker-compose.observability.yml up -d grafana

# Open Grafana
open http://localhost:3300

# Login: admin / admin
# Then change password when prompted

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
```

---

## 🛑 Troubleshooting

### QuestDB won't start
```bash
# Check Docker is running
docker ps

# Check logs
docker logs atlasmed-questdb

# Restart
docker-compose -f docker-compose.observability.yml restart questdb
```

### Can't connect to QuestDB from API
```bash
# Check .env
cat apps/api/.env | grep QUESTDB

# Should show:
# QUESTDB_ENABLED=true
# QUESTDB_HOST=localhost
# QUESTDB_PORT=9009
```

### No logs in QuestDB
```bash
# Check API logs for errors
cd apps/api
bun run dev

# Look for "QuestDB logger connected"
# If you see connection errors, check QuestDB is running
```

---

## 📚 Full Documentation

- **[QUESTDB_SETUP.md](apps/api/QUESTDB_SETUP.md)** - Complete guide (628 lines!)
- **[QUESTDB_QUICK_START.md](QUESTDB_QUICK_START.md)** - Quick reference
- **[OBSERVABILITY_SETUP.md](apps/api/OBSERVABILITY_SETUP.md)** - OpenTelemetry guide

---

**Total Time:** ~5 minutes  
**Status:** Ready to start!  
**First Step:** `docker-compose -f docker-compose.observability.yml up -d questdb`
