# 🚀 Observability Quick Start

## TL;DR

**You already have basic observability working!** No setup needed.

```bash
# Start API and watch structured logs
cd atlasmed/apps/api
bun run dev

# Test it
curl http://localhost:3000/health
curl http://localhost:3000/api/v1/access/login -X POST -H "Content-Type: application/json" -d '{"identifier":"admin@atlasmed.com","password":"password"}'
```

Look for structured logs like:
```json
{
  "level": "info",
  "requestId": "550e8400-...",
  "method": "POST",
  "route": "/api/v1/access/login",
  "statusCode": 200,
  "durationMs": 45,
  "msg": "Request completed"
}
```

---

## What's Already Working

✅ Structured JSON logs (Pino)  
✅ Request ID generation & propagation  
✅ Request duration tracking  
✅ Health checks with dependency monitoring  
✅ Prometheus metrics  
✅ Error logging with context  

---

## Optional: Add Distributed Tracing (5 minutes)

### Option 1: Jaeger (Local, Free)

```bash
# 1. Start Jaeger
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest

# 2. Add to .env
echo "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces" >> .env

# 3. Restart API
bun run dev

# 4. View traces
open http://localhost:16686
```

### Option 2: Honeycomb (Cloud, Free Tier)

```bash
# 1. Sign up at https://honeycomb.io (free: 20M events/month)

# 2. Add to .env
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://api.honeycomb.io:443
OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=YOUR_API_KEY

# 3. Restart API
bun run dev

# 4. View in Honeycomb dashboard
```

---

## Quick Commands

### View Logs
```bash
# Follow logs
bun run dev

# In another terminal, make requests
curl http://localhost:3000/health
```

### Check Health
```bash
# Detailed health
curl http://localhost:3000/health | jq

# Readiness (for K8s)
curl http://localhost:3000/health/ready

# Liveness (for K8s)
curl http://localhost:3000/health/live

# Prometheus metrics
curl http://localhost:3000/health/metrics
```

### Test Request Tracking
```bash
# Send request with custom request ID
curl http://localhost:3000/api/v1/access/login \
  -X POST \
  -H "Content-Type: application/json" \
  -H "X-Request-ID: my-custom-id-123" \
  -d '{"identifier":"admin@atlasmed.com","password":"password"}' \
  -v

# Response will include:
# x-request-id: my-custom-id-123
```

### Change Log Level
```bash
# In .env, change:
LOG_LEVEL=debug  # More verbose
LOG_LEVEL=info   # Normal (recommended)
LOG_LEVEL=warn   # Less noise
LOG_LEVEL=error  # Only errors

# Restart API to apply
```

---

## Environment Variables

### Current (Basic Setup)
```bash
OTEL_SERVICE_NAME=atlasmed-api
LOG_LEVEL=info
ENABLE_METRICS=true
```

### With OpenTelemetry (Advanced)
```bash
OTEL_SERVICE_NAME=atlasmed-api
LOG_LEVEL=info
ENABLE_METRICS=true

# Add these for distributed tracing:
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4318/v1/logs
```

---

## What You Get

### Console Logs (Now)
```json
{
  "level": "info",
  "time": "2026-05-25T19:30:00.000Z",
  "service": "atlasmed-api",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "route": "/api/v1/access/login",
  "statusCode": 200,
  "durationMs": 45,
  "userId": "user_123",
  "msg": "Request completed"
}
```

### Distributed Traces (With OpenTelemetry)
```
POST /api/v1/access/login (150ms)
├─ Rate limit check (2ms)
├─ Database query (45ms)
├─ Password verification (95ms)
└─ JWT generation (8ms)
```

---

## Recommendation

**For now:** Use what you have (console logs + health checks)

**Later:** Add Jaeger (local dev) or Honeycomb (production)

See full guide: [OBSERVABILITY_SETUP.md](./OBSERVABILITY_SETUP.md)

---

**Status:** ✅ Basic observability active  
**OpenTelemetry:** Optional, ready to enable  
**Setup time:** 0 minutes (current) or 5 minutes (with tracing)
