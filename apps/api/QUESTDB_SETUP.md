# 📊 QuestDB Integration for Observability Persistence

## Why QuestDB?

QuestDB is a **high-performance time-series database** perfect for observability data:

✅ **Fast Ingestion** - Millions of rows/second  
✅ **Efficient Storage** - Columnar format, great compression  
✅ **SQL Interface** - Familiar query language  
✅ **Time-Series Optimized** - Built-in time functions  
✅ **Low Resource Usage** - Runs great on modest hardware  
✅ **InfluxDB Line Protocol** - Easy integration  
✅ **PostgreSQL Wire Protocol** - Works with existing tools  

**Perfect for:**
- Request logs persistence
- Metrics storage (alternative to Prometheus)
- Trace data storage
- Long-term analytics
- Debugging historical issues

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Start QuestDB with Docker

```bash
# Create a docker-compose.yml in your project root
cd atlasmed
```

Create `docker-compose.observability.yml`:

```yaml
version: '3.8'

services:
  questdb:
    image: questdb/questdb:latest
    container_name: atlasmed-questdb
    ports:
      - "9000:9000"    # Web UI and REST API
      - "8812:8812"    # PostgreSQL wire protocol
      - "9009:9009"    # InfluxDB line protocol (for fast ingestion)
    volumes:
      - questdb_data:/var/lib/questdb
    environment:
      - QDB_TELEMETRY_ENABLED=false
      - QDB_HTTP_ENABLED=true
      - QDB_PG_ENABLED=true
      - QDB_LINE_ENABLED=true
    networks:
      - atlasmed

  # Optional: Add Jaeger for tracing
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: atlasmed-jaeger
    ports:
      - "16686:16686"  # Jaeger UI
      - "4318:4318"    # OTLP HTTP receiver
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    networks:
      - atlasmed

volumes:
  questdb_data:
    driver: local

networks:
  atlasmed:
    driver: bridge
```

Start it:

```bash
docker-compose -f docker-compose.observability.yml up -d

# Check it's running
docker ps | grep questdb

# Open QuestDB UI
open http://localhost:9000
```

### Step 2: Install QuestDB Client

```bash
cd apps/api
bun add @questdb/nodejs-client pg
```

### Step 3: Create QuestDB Logger

Create `src/infrastructure/logging/questdb.logger.ts`:

```typescript
import { Sender } from '@questdb/nodejs-client';
import { logger } from './logger';
import { environment } from '../../app/config/environment';

interface LogEntry {
  level: string;
  message: string;
  requestId?: string;
  userId?: string;
  method?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  error?: string;
  context?: Record<string, any>;
}

class QuestDBLogger {
  private sender: Sender | null = null;
  private enabled: boolean;

  constructor() {
    this.enabled = environment.QUESTDB_ENABLED ?? false;
    
    if (this.enabled) {
      this.connect();
    }
  }

  private async connect(): Promise<void> {
    try {
      this.sender = Sender.fromConfig({
        host: environment.QUESTDB_HOST ?? 'localhost',
        port: environment.QUESTDB_PORT ?? 9009,
      });
      
      await this.sender.connect();
      logger.info('QuestDB logger connected');
    } catch (error) {
      logger.error('Failed to connect to QuestDB', { error });
      this.enabled = false;
    }
  }

  async log(entry: LogEntry): Promise<void> {
    if (!this.enabled || !this.sender) {
      return;
    }

    try {
      // Write to QuestDB using InfluxDB Line Protocol
      // Format: measurement,tag1=value1,tag2=value2 field1=value1,field2=value2 timestamp
      
      const timestamp = Date.now() * 1000000; // nanoseconds
      
      this.sender
        .table('api_logs')
        .symbol('level', entry.level)
        .symbol('method', entry.method ?? 'UNKNOWN')
        .symbol('route', entry.route ?? 'UNKNOWN')
        .symbol('service', environment.OTEL_SERVICE_NAME)
        .symbol('environment', environment.NODE_ENV)
        .stringColumn('message', entry.message)
        .stringColumn('request_id', entry.requestId ?? '')
        .stringColumn('user_id', entry.userId ?? '')
        .intColumn('status_code', entry.statusCode ?? 0)
        .floatColumn('duration_ms', entry.durationMs ?? 0)
        .stringColumn('error', entry.error ?? '')
        .stringColumn('context', JSON.stringify(entry.context ?? {}))
        .at(timestamp);

      await this.sender.flush();
    } catch (error) {
      // Don't let logging errors crash the app
      logger.error('Failed to write to QuestDB', { error });
    }
  }

  async logMetric(
    name: string,
    value: number,
    tags: Record<string, string> = {}
  ): Promise<void> {
    if (!this.enabled || !this.sender) {
      return;
    }

    try {
      const timestamp = Date.now() * 1000000;
      
      let row = this.sender.table('api_metrics');
      
      // Add all tags as symbols
      row = row.symbol('metric_name', name);
      for (const [key, val] of Object.entries(tags)) {
        row = row.symbol(key, val);
      }
      
      row
        .floatColumn('value', value)
        .at(timestamp);

      await this.sender.flush();
    } catch (error) {
      logger.error('Failed to write metric to QuestDB', { error });
    }
  }

  async close(): Promise<void> {
    if (this.sender) {
      await this.sender.close();
      this.sender = null;
    }
  }
}

export const questdbLogger = new QuestDBLogger();
```

### Step 4: Update Environment Configuration

Add to `src/app/config/environment.ts`:

```typescript
// In the schema, add:
QUESTDB_ENABLED: Type.Boolean({
  default: false,
  description: 'Enable QuestDB logging'
}),

QUESTDB_HOST: Type.String({
  default: 'localhost',
  description: 'QuestDB host'
}),

QUESTDB_PORT: Type.Number({
  default: 9009,
  minimum: 1,
  description: 'QuestDB line protocol port'
}),
```

And in the environment object:

```typescript
QUESTDB_ENABLED: process.env.QUESTDB_ENABLED === 'true',
QUESTDB_HOST: process.env.QUESTDB_HOST ?? 'localhost',
QUESTDB_PORT: parseInt(process.env.QUESTDB_PORT ?? '9009', 10),
```

### Step 5: Update Observability Plugin

Update `src/infrastructure/plugins/observability.plugin.ts`:

```typescript
import { questdbLogger } from '../logging/questdb.logger';

// In the onAfterResponse handler, add:
await questdbLogger.log({
  level: statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
  message: 'Request completed',
  requestId: observation.requestId,
  userId: set.userId,
  method: observation.method,
  route: observation.path,
  statusCode,
  durationMs,
});
```

### Step 6: Update .env

Add to your `.env`:

```bash
# ============================================================================
# QuestDB Configuration
# ============================================================================
QUESTDB_ENABLED=true
QUESTDB_HOST=localhost
QUESTDB_PORT=9009
```

### Step 7: Create Tables in QuestDB

Open QuestDB UI: http://localhost:9000

Run this SQL to create the schema:

```sql
-- API Logs Table
CREATE TABLE IF NOT EXISTS api_logs (
  level SYMBOL,
  method SYMBOL,
  route SYMBOL,
  service SYMBOL,
  environment SYMBOL,
  message STRING,
  request_id STRING,
  user_id STRING,
  status_code INT,
  duration_ms DOUBLE,
  error STRING,
  context STRING,
  timestamp TIMESTAMP
) timestamp(timestamp) PARTITION BY DAY;

-- Add indexes for common queries
ALTER TABLE api_logs ADD INDEX level;
ALTER TABLE api_logs ADD INDEX method;
ALTER TABLE api_logs ADD INDEX route;
ALTER TABLE api_logs ADD INDEX request_id;

-- API Metrics Table
CREATE TABLE IF NOT EXISTS api_metrics (
  metric_name SYMBOL,
  service SYMBOL,
  environment SYMBOL,
  method SYMBOL,
  route SYMBOL,
  status SYMBOL,
  value DOUBLE,
  timestamp TIMESTAMP
) timestamp(timestamp) PARTITION BY DAY;

-- Add indexes
ALTER TABLE api_metrics ADD INDEX metric_name;
ALTER TABLE api_metrics ADD INDEX method;
ALTER TABLE api_metrics ADD INDEX route;
```

### Step 8: Test It

```bash
# Start your API
cd apps/api
bun run dev

# Make some requests
curl http://localhost:3000/api/v1/access/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@atlasmed.com","password":"password"}'

# Check QuestDB UI
open http://localhost:9000

# Run a query:
SELECT * FROM api_logs ORDER BY timestamp DESC LIMIT 100;
```

---

## 📊 Useful Queries

### 1. Recent Requests

```sql
-- Last 100 requests
SELECT 
  timestamp,
  level,
  method,
  route,
  status_code,
  duration_ms,
  request_id
FROM api_logs
ORDER BY timestamp DESC
LIMIT 100;
```

### 2. Error Rate

```sql
-- Error rate by endpoint (last hour)
SELECT 
  route,
  COUNT(*) as total_requests,
  SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as errors,
  (SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) as error_rate
FROM api_logs
WHERE timestamp > dateadd('h', -1, now())
GROUP BY route
ORDER BY error_rate DESC;
```

### 3. Response Time Percentiles

```sql
-- P50, P95, P99 response times by endpoint (last hour)
SELECT 
  route,
  COUNT(*) as requests,
  approx_percentile(duration_ms, 0.5) as p50_ms,
  approx_percentile(duration_ms, 0.95) as p95_ms,
  approx_percentile(duration_ms, 0.99) as p99_ms,
  MAX(duration_ms) as max_ms
FROM api_logs
WHERE timestamp > dateadd('h', -1, now())
  AND duration_ms > 0
GROUP BY route
ORDER BY requests DESC;
```

### 4. Requests Per Minute

```sql
-- Requests per minute (last hour)
SELECT 
  timestamp_floor('m', timestamp) as minute,
  COUNT(*) as requests
FROM api_logs
WHERE timestamp > dateadd('h', -1, now())
SAMPLE BY 1m
ORDER BY minute DESC;
```

### 5. Slow Requests

```sql
-- Slowest requests (last hour)
SELECT 
  timestamp,
  method,
  route,
  duration_ms,
  status_code,
  request_id,
  user_id
FROM api_logs
WHERE timestamp > dateadd('h', -1, now())
  AND duration_ms > 1000  -- Slower than 1 second
ORDER BY duration_ms DESC
LIMIT 50;
```

### 6. Requests by User

```sql
-- Top users by request count (last 24 hours)
SELECT 
  user_id,
  COUNT(*) as requests,
  AVG(duration_ms) as avg_duration_ms,
  SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
FROM api_logs
WHERE timestamp > dateadd('d', -1, now())
  AND user_id != ''
GROUP BY user_id
ORDER BY requests DESC
LIMIT 20;
```

### 7. Failed Logins

```sql
-- Failed login attempts (last 24 hours)
SELECT 
  timestamp,
  request_id,
  status_code,
  message,
  context
FROM api_logs
WHERE timestamp > dateadd('d', -1, now())
  AND route = '/api/v1/access/login'
  AND status_code >= 400
ORDER BY timestamp DESC;
```

### 8. Request Volume by Hour

```sql
-- Requests per hour (last 7 days)
SELECT 
  timestamp_floor('h', timestamp) as hour,
  COUNT(*) as requests,
  AVG(duration_ms) as avg_duration_ms
FROM api_logs
WHERE timestamp > dateadd('d', -7, now())
SAMPLE BY 1h
ORDER BY hour DESC;
```

---

## 📈 Dashboard Queries

### Real-Time Dashboard

Create a dashboard that refreshes every 10 seconds:

```sql
-- 1. Current Requests/sec
SELECT 
  timestamp_floor('s', timestamp) as second,
  COUNT(*) as rps
FROM api_logs
WHERE timestamp > dateadd('m', -5, now())
SAMPLE BY 1s
ORDER BY second DESC
LIMIT 300;

-- 2. Error Rate (last 5 minutes)
SELECT 
  timestamp_floor('m', timestamp) as minute,
  SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as error_rate
FROM api_logs
WHERE timestamp > dateadd('m', -5, now())
SAMPLE BY 1m;

-- 3. Top Endpoints (last hour)
SELECT 
  route,
  COUNT(*) as requests
FROM api_logs
WHERE timestamp > dateadd('h', -1, now())
GROUP BY route
ORDER BY requests DESC
LIMIT 10;

-- 4. Response Time Distribution
SELECT 
  CASE 
    WHEN duration_ms < 10 THEN '0-10ms'
    WHEN duration_ms < 50 THEN '10-50ms'
    WHEN duration_ms < 100 THEN '50-100ms'
    WHEN duration_ms < 500 THEN '100-500ms'
    WHEN duration_ms < 1000 THEN '500ms-1s'
    ELSE '>1s'
  END as bucket,
  COUNT(*) as requests
FROM api_logs
WHERE timestamp > dateadd('h', -1, now())
GROUP BY bucket
ORDER BY bucket;
```

---

## 🔍 Advanced Use Cases

### 1. Track Request Journey

```sql
-- Find all logs for a specific request ID
SELECT 
  timestamp,
  level,
  message,
  route,
  status_code,
  duration_ms,
  context
FROM api_logs
WHERE request_id = 'YOUR_REQUEST_ID'
ORDER BY timestamp;
```

### 2. Database Query Performance

If you log database queries:

```sql
-- Slowest database operations
SELECT 
  timestamp,
  route,
  duration_ms,
  context
FROM api_logs
WHERE message LIKE '%database%'
  AND duration_ms > 100
ORDER BY duration_ms DESC
LIMIT 50;
```

### 3. User Activity Timeline

```sql
-- User activity (last 24 hours)
SELECT 
  timestamp,
  method,
  route,
  status_code,
  duration_ms,
  request_id
FROM api_logs
WHERE user_id = 'USER_ID'
  AND timestamp > dateadd('d', -1, now())
ORDER BY timestamp DESC;
```

### 4. Anomaly Detection

```sql
-- Detect sudden spikes in errors
WITH hourly_stats AS (
  SELECT 
    timestamp_floor('h', timestamp) as hour,
    COUNT(*) as total,
    SUM(CASE WHEN status_code >= 500 THEN 1 ELSE 0 END) as errors
  FROM api_logs
  WHERE timestamp > dateadd('d', -7, now())
  SAMPLE BY 1h
)
SELECT 
  hour,
  total,
  errors,
  (errors * 100.0 / total) as error_rate
FROM hourly_stats
WHERE error_rate > 5  -- Alert if error rate > 5%
ORDER BY hour DESC;
```

---

## 🔧 Integration with Grafana

QuestDB works great with Grafana for visualization!

### Setup Grafana

Add to your `docker-compose.observability.yml`:

```yaml
  grafana:
    image: grafana/grafana:latest
    container_name: atlasmed-grafana
    ports:
      - "3300:3000"
    volumes:
      - grafana_data:/var/lib/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    networks:
      - atlasmed

volumes:
  grafana_data:
```

Restart:

```bash
docker-compose -f docker-compose.observability.yml up -d grafana
```

### Connect QuestDB to Grafana

1. Open Grafana: http://localhost:3300
2. Login: admin/admin
3. Add Data Source → PostgreSQL
4. Configure:
   - Host: `questdb:8812`
   - Database: `qdb`
   - User: `admin`
   - Password: `quest`
   - SSL Mode: disable

5. Create dashboard with queries above!

---

## 💾 Data Retention

### Auto-Delete Old Data

```sql
-- Delete logs older than 30 days (run daily)
ALTER TABLE api_logs DROP PARTITION 
WHERE timestamp < dateadd('d', -30, now());

-- Delete metrics older than 90 days
ALTER TABLE api_metrics DROP PARTITION 
WHERE timestamp < dateadd('d', -90, now());
```

### Create a Cleanup Job

Add to your API:

```typescript
// src/infrastructure/jobs/cleanup.job.ts
import { Pool } from 'pg';
import { logger } from '../logging/logger';
import { environment } from '../../app/config/environment';

const pool = new Pool({
  host: environment.QUESTDB_HOST,
  port: 8812,  // PostgreSQL wire protocol
  database: 'qdb',
  user: 'admin',
  password: 'quest',
});

export async function cleanupOldLogs() {
  try {
    const retentionDays = 30;
    
    const result = await pool.query(`
      ALTER TABLE api_logs DROP PARTITION 
      WHERE timestamp < dateadd('d', -${retentionDays}, now())
    `);
    
    logger.info('Cleaned up old logs', { retentionDays });
  } catch (error) {
    logger.error('Failed to cleanup old logs', { error });
  }
}

// Run daily
setInterval(cleanupOldLogs, 24 * 60 * 60 * 1000);
```

---

## 🚀 Production Setup

### Environment Variables

```bash
# Production
QUESTDB_ENABLED=true
QUESTDB_HOST=questdb.your-domain.com
QUESTDB_PORT=9009

# Or use connection string
QUESTDB_CONNECTION_STRING=tcp::addr=questdb.your-domain.com:9009;
```

### Docker Compose for Production

```yaml
version: '3.8'

services:
  questdb:
    image: questdb/questdb:latest
    restart: unless-stopped
    ports:
      - "9000:9000"
      - "8812:8812"
      - "9009:9009"
    volumes:
      - /data/questdb:/var/lib/questdb
    environment:
      - QDB_TELEMETRY_ENABLED=false
      - QDB_HTTP_ENABLED=true
      - QDB_PG_ENABLED=true
      - QDB_LINE_ENABLED=true
      - QDB_HTTP_MIN_NET_CONNECTION_POOL_SIZE=8
      - QDB_HTTP_MAX_NET_CONNECTION_POOL_SIZE=64
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G
        reservations:
          cpus: '2'
          memory: 4G
```

### Security

```sql
-- Create read-only user for Grafana
CREATE USER grafana_reader;
GRANT SELECT ON ALL TABLES TO grafana_reader;

-- Create write-only user for API
CREATE USER api_writer;
GRANT INSERT ON api_logs TO api_writer;
GRANT INSERT ON api_metrics TO api_writer;
```

---

## 📊 Benefits Summary

| Feature | Before | With QuestDB |
|---------|--------|--------------|
| **Log Storage** | Console only | Persistent database |
| **Search** | `grep` logs | SQL queries |
| **Analytics** | Manual counting | Aggregations, percentiles |
| **Retention** | Limited by disk | Configurable (30+ days) |
| **Performance** | N/A | Sub-second queries on millions of rows |
| **Dashboards** | None | Grafana integration |
| **Alerting** | Manual | Automated based on queries |

---

## 🎯 Next Steps

1. ✅ Start QuestDB with Docker
2. ✅ Add client library
3. ✅ Create tables
4. ✅ Update environment config
5. ✅ Integrate with observability plugin
6. ✅ Test with sample queries
7. ✅ Set up Grafana (optional)
8. ✅ Configure data retention

---

## 📚 Resources

- [QuestDB Documentation](https://questdb.io/docs/)
- [QuestDB Node.js Client](https://questdb.io/docs/clients/nodejs/)
- [QuestDB SQL Reference](https://questdb.io/docs/reference/sql/)
- [Grafana QuestDB Plugin](https://questdb.io/docs/third-party-tools/grafana/)

---

**Status:** Ready to implement  
**Setup Time:** 15 minutes  
**Complexity:** Medium  
**Benefits:** High - Persistent observability data with powerful querying
