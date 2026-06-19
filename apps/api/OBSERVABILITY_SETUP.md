# 🔭 Observability & OpenTelemetry Setup Guide

## What's Already Working

Good news! **Basic observability is already enabled** in your API:

✅ **Structured Logging** - Pino logger with JSON output  
✅ **Request Tracking** - Every request gets a unique ID  
✅ **Request Duration** - Automatic timing for all requests  
✅ **Health Checks** - 4 endpoints with dependency checks  
✅ **Metrics Collection** - Prometheus metrics ready  

**Currently Active (No Setup Needed):**
- Request ID generation and propagation
- Structured logging to console
- Health monitoring endpoints
- Request/response logging

**Optional (Requires Setup):**
- OpenTelemetry distributed tracing
- External observability platforms
- Log aggregation services

---

## 📊 Current Configuration

Your current `.env` file:

```bash
# Observability Configuration
OTEL_SERVICE_NAME=atlasmed-api     # ✅ Set
LOG_LEVEL=info                     # ✅ Set

# Optional - Not configured yet
# OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=
# OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=
```

---

## 🎯 Quick Test - See What's Working

### 1. Check Structured Logs

Start your API and watch the logs:

```bash
cd atlasmed/apps/api
bun run dev
```

You'll see structured logs like:

```json
{
  "level": "info",
  "time": "2026-05-25T19:30:00.000Z",
  "service": "atlasmed-api",
  "environment": "development",
  "msg": "Server started on port 3000"
}
```

### 2. Make a Request with Request ID

```bash
# API will generate a request ID automatically
curl http://localhost:3000/api/v1/access/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin@atlasmed.com","password":"password"}' \
  -v

# Look for this header in the response:
# x-request-id: 550e8400-e29b-41d4-a716-446655440000
```

Check your API logs - you'll see:

```json
{
  "level": "info",
  "time": "2026-05-25T19:30:15.000Z",
  "service": "atlasmed-api",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "POST",
  "route": "/api/v1/access/login",
  "statusCode": 200,
  "durationMs": 45,
  "msg": "Request completed"
}
```

### 3. Check Health Endpoints

```bash
# Detailed health with metrics
curl http://localhost:3000/health

# Response includes system info
{
  "status": "healthy",
  "timestamp": "2026-05-25T19:30:00Z",
  "checks": {
    "database": { "status": "healthy", "latency": 5 },
    "redis": { "status": "healthy", "latency": 1 }
  },
  "system": {
    "uptime": 3600,
    "memory": { "used": 150, "total": 8192 },
    "cpu": { "user": 1234, "system": 5678 }
  }
}
```

### 4. Check Prometheus Metrics

```bash
curl http://localhost:3000/health/metrics

# Output (Prometheus format):
# TYPE http_requests_total counter
http_requests_total{method="POST",route="/api/v1/access/login",status="200"} 42

# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.005"} 10
http_request_duration_seconds_bucket{le="0.01"} 25
...
```

---

## 🚀 Enable Full OpenTelemetry (Optional)

Want distributed tracing and advanced observability? Here's how to set it up with popular platforms.

### Option 1: Jaeger (Free, Self-Hosted)

**Best for:** Local development and learning

#### Step 1: Run Jaeger with Docker

```bash
docker run -d --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

#### Step 2: Update `.env`

```bash
# Add these lines
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4318/v1/logs
```

#### Step 3: Restart API

```bash
bun run dev
```

#### Step 4: View Traces

1. Make some API requests
2. Open Jaeger UI: http://localhost:16686
3. Select service: `atlasmed-api`
4. Click "Find Traces"

**What You'll See:**
- Request traces with duration
- Span details (database queries, Redis calls)
- Request flow visualization
- Performance bottlenecks

---

### Option 2: Honeycomb (Cloud, Free Tier)

**Best for:** Production, teams, advanced analytics

#### Step 1: Create Account

1. Go to https://honeycomb.io
2. Sign up (free tier: 20M events/month)
3. Create a new environment

#### Step 2: Get API Key

1. Go to Account → Team Settings → API Keys
2. Create new key: "AtlasMed API"
3. Copy the key

#### Step 3: Update `.env`

```bash
# Add these lines
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://api.honeycomb.io:443
OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=YOUR_API_KEY
```

#### Step 4: Restart API

```bash
bun run dev
```

#### Step 5: View in Honeycomb

1. Go to Honeycomb dashboard
2. Select your dataset: `atlasmed-api`
3. Explore traces, queries, and performance

**Features:**
- ✅ BubbleUp (automatic root cause analysis)
- ✅ Query builder (no coding needed)
- ✅ Alerts and SLOs
- ✅ Team collaboration
- ✅ Trace waterfall visualization

---

### Option 3: Grafana Cloud (Free Tier)

**Best for:** All-in-one observability (metrics + logs + traces)

#### Step 1: Setup

1. Go to https://grafana.com/auth/sign-up
2. Create free account
3. Go to "Grafana Cloud" → "Send Data"
4. Select "OpenTelemetry"

#### Step 2: Get Credentials

Copy the provided endpoint and authentication.

#### Step 3: Update `.env`

```bash
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://otlp-gateway-prod-us-central-0.grafana.net/otlp
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic YOUR_ENCODED_CREDENTIALS
```

#### Step 4: View Data

- **Traces:** Grafana → Explore → Tempo
- **Logs:** Grafana → Explore → Loki
- **Metrics:** Grafana → Explore → Prometheus

---

### Option 4: Datadog (Paid, Free Trial)

**Best for:** Enterprise, full-featured APM

#### Setup

```bash
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
# Run Datadog agent locally or use cloud endpoint
```

---

### Option 5: New Relic (Paid, Free Tier)

**Best for:** APM with AI/ML insights

```bash
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://otlp.nr-data.net:443
OTEL_EXPORTER_OTLP_HEADERS=api-key=YOUR_NEW_RELIC_KEY
```

---

## 🎨 Complete Environment Configuration

### Full `.env` Example (with Jaeger)

```bash
# ============================================================================
# Observability Configuration
# ============================================================================

# Service Identification
OTEL_SERVICE_NAME=atlasmed-api

# Logging
LOG_LEVEL=info  # Options: debug, info, warn, error

# OpenTelemetry Exporters (Optional)
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4318/v1/logs

# Feature Flags
ENABLE_METRICS=true    # Prometheus metrics
ENABLE_AUDIT_LOG=true  # Database audit logging
```

### Production Example (with Honeycomb)

```bash
# Observability Configuration
OTEL_SERVICE_NAME=atlasmed-api-production
LOG_LEVEL=info

# Honeycomb
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://api.honeycomb.io:443
OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=YOUR_PRODUCTION_KEY,x-honeycomb-dataset=atlasmed-production

ENABLE_METRICS=true
ENABLE_AUDIT_LOG=true
```

---

## 📊 What You Get

### Without OpenTelemetry (Current State)

✅ **Console Logs**
- Structured JSON logs
- Request IDs
- Timestamps
- Request details

✅ **Health Checks**
- Liveness probes
- Readiness probes
- Dependency status
- System metrics

✅ **Request Tracking**
- Unique request IDs
- Duration tracking
- Status codes
- User context

### With OpenTelemetry Enabled

All of the above **PLUS:**

✅ **Distributed Tracing**
- End-to-end request visualization
- Service dependency mapping
- Performance bottlenecks
- Database query timing

✅ **Advanced Analytics**
- Query any field
- Aggregate metrics
- Percentile calculations
- Custom dashboards

✅ **Alerting**
- Error rate spikes
- Slow requests
- Dependency failures
- Custom conditions

✅ **Correlation**
- Link logs to traces
- Link traces to metrics
- See full request context

---

## 🔍 Understanding the Traces

### What Gets Traced

Every request automatically includes:

**HTTP Attributes:**
- `http.request.method`: GET, POST, etc.
- `http.response.status_code`: 200, 404, etc.
- `url.path`: /api/v1/access/login

**Application Attributes:**
- `app.namespace`: api, health, or internal
- `request.id`: Unique request identifier
- `user.id`: Authenticated user (if logged in)

**Timing:**
- Request start time
- Request duration
- Individual span durations

**Example Trace:**
```
POST /api/v1/access/login (150ms)
├─ Check rate limit (2ms)
├─ Query database (45ms)
│  └─ SELECT * FROM users WHERE email = ? (43ms)
├─ Verify password (95ms)
│  └─ bcrypt.compare (94ms)
└─ Generate JWT (8ms)
```

---

## 🎓 Best Practices

### 1. Log Levels

Use appropriate log levels:

```typescript
logger.debug('Cache hit', { key: 'user:123' });        // Development debugging
logger.info('User logged in', { userId: '123' });      // Normal operations
logger.warn('Rate limit approaching', { usage: 95 });  // Potential issues
logger.error('Database connection failed', { error }); // Actual problems
```

**Production:** Set `LOG_LEVEL=info` or `warn`  
**Development:** Set `LOG_LEVEL=debug`

### 2. Request ID Propagation

Always include request IDs in error reports:

```typescript
// Frontend
try {
  const response = await fetch('/api/v1/users');
  const requestId = response.headers.get('x-request-id');
} catch (error) {
  console.error('Request failed', { requestId, error });
  // Send to error tracking with requestId
}
```

### 3. Health Check Monitoring

Set up alerts on health endpoints:

```bash
# Kubernetes liveness probe
livenessProbe:
  httpGet:
    path: /health/live
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30

# Kubernetes readiness probe
readinessProbe:
  httpGet:
    path: /health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
```

### 4. Metrics Collection

Scrape Prometheus metrics:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'atlasmed-api'
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/health/metrics'
    scrape_interval: 15s
```

---

## 🐛 Troubleshooting

### Issue: No traces appearing in Jaeger

**Check:**
1. Is Jaeger running? `docker ps | grep jaeger`
2. Is endpoint correct? Check `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT`
3. Restart API after env changes
4. Check API logs for OTEL errors

### Issue: Logs not structured in production

**Cause:** `NODE_ENV` not set to `production`

**Fix:**
```bash
NODE_ENV=production
```

Pino will automatically switch to JSON format in production.

### Issue: Health check fails

**Check:**
1. Database connection: `psql $DATABASE_URL`
2. Redis connection: `redis-cli -u $REDIS_URL ping`
3. Check `/health` endpoint for details

### Issue: Too many logs

**Reduce log noise:**
```bash
# Less verbose
LOG_LEVEL=warn

# Or filter health checks (already done in code)
# Health checks are automatically quieter in production
```

---

## 📈 Recommended Setup by Environment

### Local Development

```bash
OTEL_SERVICE_NAME=atlasmed-api-dev
LOG_LEVEL=debug
# No OTEL exporter - console logs only
ENABLE_METRICS=false
```

**Why:** Console logs are enough for local debugging.

### Staging

```bash
OTEL_SERVICE_NAME=atlasmed-api-staging
LOG_LEVEL=info
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://jaeger:4318/v1/traces
ENABLE_METRICS=true
```

**Why:** Test observability setup before production.

### Production

```bash
OTEL_SERVICE_NAME=atlasmed-api-production
LOG_LEVEL=info
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://api.honeycomb.io:443
OTEL_EXPORTER_OTLP_HEADERS=x-honeycomb-team=prod_key
ENABLE_METRICS=true
ENABLE_AUDIT_LOG=true
```

**Why:** Full observability for monitoring and debugging.

---

## 🎯 Quick Start Recommendations

### For Now (Getting Started)

**Don't set up OpenTelemetry yet.** You already have:
- ✅ Structured logs
- ✅ Request IDs
- ✅ Health checks
- ✅ Duration tracking

**This is enough for:**
- Local development
- Basic debugging
- API testing
- Learning the system

### When to Add OpenTelemetry

Add it when you need:
- **Staging/Production deployments**
- **Team collaboration** on debugging
- **Performance optimization**
- **Root cause analysis** of complex issues
- **Distributed system debugging**

### Easiest Path

1. **Today:** Keep current setup (console logs)
2. **Before production:** Add Jaeger locally (5 minutes)
3. **For production:** Sign up for Honeycomb free tier (10 minutes)

---

## 📚 Additional Resources

### Documentation

- [Phase 2 Implementation Guide](./docs/PHASE2_IMPLEMENTATION.md)
- [Error Codes Reference](./docs/ERROR_CODES.md)
- [OpenTelemetry Docs](https://opentelemetry.io/docs/)
- [Pino Logger Docs](https://getpino.io/)

### Observability Platforms

- [Jaeger](https://www.jaegertracing.io/) - Open source tracing
- [Honeycomb](https://honeycomb.io/) - Best developer experience
- [Grafana Cloud](https://grafana.com/products/cloud/) - All-in-one
- [Datadog](https://www.datadoghq.com/) - Enterprise APM
- [New Relic](https://newrelic.com/) - AI-powered insights

---

## ✅ Summary

**What's working now (no setup needed):**
- Structured logging with Pino
- Request ID tracking
- Health monitoring
- Request duration tracking
- Prometheus metrics

**What's optional (requires setup):**
- OpenTelemetry distributed tracing
- External observability platforms
- Log aggregation

**Recommendation:**
Start with what you have. Add OpenTelemetry when you're ready to deploy to staging/production or when you need advanced debugging capabilities.

---

**Last Updated:** May 25, 2026  
**Status:** ✅ Basic observability active, OpenTelemetry ready to enable
