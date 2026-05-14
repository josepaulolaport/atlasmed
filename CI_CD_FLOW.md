# CI/CD Pipeline with Uncloud & Caddy

This document explains how your complete CI/CD pipeline works with Uncloud and Caddy.

## Complete CI/CD Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                        Developer Workflow                             │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                         git push to main
                                  │
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│                          GitHub Repository                            │
│  - Code changes detected in backend/, web/, or mobile/               │
│  - Path-based triggers activate relevant workflows                    │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ↓
┌──────────────────────────────────────────────────────────────────────┐
│                       GitHub Actions (CI/CD)                          │
│                                                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ Backend Workflow│  │  Web Workflow   │  │ Mobile Workflow │    │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤    │
│  │ 1. Checkout     │  │ 1. Checkout     │  │ 1. Checkout     │    │
│  │ 2. Setup Bun    │  │ 2. Setup Bun    │  │ 2. Setup Flutter│    │
│  │ 3. Install deps │  │ 3. Install deps │  │ 3. Install deps │    │
│  │ 4. Run lint     │  │ 4. Run lint     │  │ 4. Run analyzer │    │
│  │ 5. Run tests    │  │ 5. Build Next.js│  │ 5. Run tests    │    │
│  │ 6. Deploy ✓     │  │ 6. Run tests    │  │ 6. Build APK/iOS│    │
│  └────────┬────────┘  │ 7. Deploy ✓     │  │ 7. Deploy ✓     │    │
│           │           └────────┬────────┘  └────────┬────────┘    │
│           │                    │                     │              │
│  GitHub Secrets:               │                     │              │
│  - UNCLOUD_SSH_KEY            │                     │              │
│  - UNCLOUD_HOST               │                     │              │
│  - DATABASE_URL               │                     │              │
│  - JWT_SECRET                 │                     │              │
└───────────┼────────────────────┼─────────────────────┼──────────────┘
            │                    │                     │
            ↓                    ↓                     ↓
┌───────────────────────────────────────────┐  ┌────────────────────┐
│     Uncloud (Your VPS Infrastructure)     │  │   Mobile App       │
│                                           │  │   Stores           │
│  ┌────────────────────────────────────┐  │  ├────────────────────┤
│  │  Uncloud Orchestration Layer       │  │  │ → TestFlight (iOS) │
│  │  - Receives deployment commands    │  │  │ → Play Store       │
│  │  - Builds Docker images            │  │  │   (Android)        │
│  │  - Manages container lifecycle     │  │  └────────────────────┘
│  │  - Handles zero-downtime updates   │  │
│  │  - Distributes across machines     │  │
│  └────────────────┬───────────────────┘  │
│                   │                       │
│                   ↓                       │
│  ┌────────────────────────────────────┐  │
│  │  Caddy (Built into Uncloud)        │  │
│  │  - Automatic HTTPS (Let's Encrypt) │  │
│  │  - SSL Certificate Management      │  │
│  │  - Reverse Proxy                   │  │
│  │  - Load Balancing                  │  │
│  └───────┬────────────────┬───────────┘  │
│          │                │               │
│          ↓                ↓               │
│  ┌──────────────┐  ┌──────────────┐     │
│  │   Backend    │  │  Web Frontend│     │
│  │   Container  │  │  Container   │     │
│  ├──────────────┤  ├──────────────┤     │
│  │ Bun + Elysia │  │  Next.js     │     │
│  │ Port: 3001   │  │  Port: 3000  │     │
│  │              │  │              │     │
│  │ Health:      │  │ Health:      │     │
│  │ /health      │  │ /api/health  │     │
│  └──────────────┘  └──────────────┘     │
│                                          │
└──────────────────────────────────────────┘
            │                │
            ↓                ↓
┌────────────────────────────────────────┐
│         Internet (Public Access)        │
├─────────────────────────────────────────┤
│ ✅ https://api.atlasmed.com             │
│    → Backend API (via Caddy)            │
│                                         │
│ ✅ https://atlasmed.com                 │
│    → Web Frontend (via Caddy)           │
│                                         │
│ 📱 Mobile App connects to:              │
│    https://api.atlasmed.com             │
└─────────────────────────────────────────┘
```

## Component Roles in CI/CD

### 1. GitHub Actions (CI/CD Orchestrator)

**What it does:**
- Triggers on code changes (path-based)
- Runs tests and linters
- Builds applications
- Deploys to Uncloud
- Manages secrets securely

**Configuration:**
- `.github/workflows/backend-ci.yml`
- `.github/workflows/web-ci.yml`
- `.github/workflows/mobile-ci.yml`

**Required GitHub Secrets:**
```bash
UNCLOUD_SSH_KEY      # SSH private key to access Uncloud machine
UNCLOUD_HOST         # IP or hostname of Uncloud server
DATABASE_URL         # Production database connection
JWT_SECRET           # Backend JWT signing secret
CORS_ORIGIN          # Allowed CORS origin (https://atlasmed.com)
NEXT_PUBLIC_API_URL  # Web app API endpoint
API_SECRET_KEY       # Server-side API key
```

### 2. Uncloud (Deployment Platform)

**What it does:**
- Receives deployment commands from GitHub Actions
- Builds Docker containers
- Manages container lifecycle
- Performs zero-downtime rolling updates
- Distributes containers across multiple machines
- Handles service discovery

**Configuration:**
- `docker-compose.yml` - Defines all services
- `backend/Dockerfile` - Backend container image
- `web/Dockerfile` - Web frontend container image

**Where it runs:**
- Your own VPS/servers (DigitalOcean, Hetzner, AWS EC2, etc.)
- No central control plane (decentralized)
- WireGuard mesh network for secure communication

### 3. Caddy (Web Server & Reverse Proxy)

**What it does:**
- **Automatic HTTPS** - Obtains SSL certificates from Let's Encrypt
- **Certificate Management** - Auto-renewal, no manual intervention
- **Reverse Proxy** - Routes requests to backend/frontend containers
- **Load Balancing** - Distributes traffic across container replicas
- **HTTP → HTTPS Redirect** - Forces secure connections

**Built into Uncloud:**
- No separate installation needed
- Configured via Docker labels in `docker-compose.yml`
- Automatic DNS-based routing

**Configuration Examples:**
```yaml
# In docker-compose.yml
labels:
  - "uncloud.http.routers.backend.rule=Host(`api.atlasmed.com`)"
  - "uncloud.http.routers.backend.entrypoints=https"
  - "uncloud.http.routers.backend.tls.certresolver=letsencrypt"
```

## Deployment Scenarios

### Scenario 1: Backend Code Change

```
Developer pushes backend code → GitHub Actions detects change in backend/
    ↓
GitHub Actions runs backend tests
    ↓
Tests pass → GitHub Actions connects to Uncloud via SSH
    ↓
Uncloud receives: uc run --name atlasmed-backend --port api.atlasmed.com:3001/https
    ↓
Uncloud builds new Docker image from backend/Dockerfile
    ↓
Uncloud performs rolling update:
  1. Starts new container
  2. Waits for health check (/health endpoint)
  3. Caddy routes traffic to new container
  4. Stops old container
    ↓
Caddy ensures HTTPS at https://api.atlasmed.com
    ↓
✅ Backend deployed with zero downtime
```

### Scenario 2: Web App Change

```
Developer pushes web code → GitHub Actions detects change in web/
    ↓
GitHub Actions builds Next.js app
    ↓
Build succeeds → GitHub Actions connects to Uncloud via SSH
    ↓
Uncloud receives: uc run --name atlasmed-web --port atlasmed.com:3000/https
    ↓
Uncloud builds new Docker image from web/Dockerfile
    ↓
Uncloud performs rolling update:
  1. Starts new container
  2. Waits for health check
  3. Caddy routes traffic to new container
  4. Stops old container
    ↓
Caddy ensures HTTPS at https://atlasmed.com
    ↓
✅ Web app deployed with zero downtime
```

### Scenario 3: Mobile App Change

```
Developer pushes mobile code → GitHub Actions detects change in mobile/
    ↓
GitHub Actions builds Flutter app (APK/AAB for Android, IPA for iOS)
    ↓
Build succeeds → GitHub Actions uploads to app stores
    ↓
✅ Mobile builds available in TestFlight / Play Store Internal Testing
    ↓
Mobile app connects to: https://api.atlasmed.com (via Caddy)
```

### Scenario 4: Shared Types Change

```
Developer updates shared/types/ → GitHub Actions detects change
    ↓
Both backend and web workflows trigger (shared/** in path filters)
    ↓
Both deploy simultaneously with new types
    ↓
✅ Type safety maintained across full stack
```

## Why This Setup Works Well

### 1. Independent Deployments
- Backend, web, and mobile deploy independently
- Path-based triggers prevent unnecessary deployments
- Only changed components rebuild and redeploy

### 2. Automatic HTTPS
- Caddy handles SSL certificates automatically
- No manual certificate management
- Works for all domains and subdomains

### 3. Zero Downtime
- Rolling updates via Uncloud
- Health checks ensure new containers are ready
- Traffic switches seamlessly

### 4. Secure Secrets
- GitHub Secrets encrypted at rest
- Never exposed in logs or code
- Injected only during deployment

### 5. Self-Hosted Benefits
- Full infrastructure control
- Predictable costs (~$30-60/month)
- No vendor lock-in
- Mix cloud providers freely

## Quick Setup Checklist

### One-Time Setup

- [ ] Set up VPS/server for Uncloud
- [ ] Install Uncloud: `uc machine init user@server`
- [ ] Point DNS records to your server
  - `api.atlasmed.com` → your server IP
  - `atlasmed.com` → your server IP
- [ ] Add GitHub Secrets to repository
  - UNCLOUD_SSH_KEY
  - UNCLOUD_HOST
  - DATABASE_URL
  - JWT_SECRET
  - etc.

### Every Deploy (Automatic)

1. Push code to `main` branch
2. GitHub Actions triggers automatically
3. Tests run
4. If tests pass, deployment happens
5. Uncloud builds and deploys
6. Caddy provisions HTTPS
7. Your app is live!

## Monitoring Your Pipeline

### View GitHub Actions

```
GitHub Repo → Actions tab → Select workflow run
```

### View Uncloud Deployments

```bash
# List running services
uc ps

# View logs
uc logs atlasmed-backend --follow
uc logs atlasmed-web --follow

# Check service health
uc ps --health
```

### View Caddy HTTPS Status

```bash
# SSH into your Uncloud machine
ssh user@your-server

# Check Caddy logs
docker logs <caddy-container-id>

# Verify SSL certificate
curl -vI https://api.atlasmed.com
```

## Troubleshooting

### Deployment Fails in GitHub Actions

**Check:**
- GitHub Secrets are set correctly
- UNCLOUD_SSH_KEY is valid
- UNCLOUD_HOST is reachable

**Debug:**
```bash
# Test SSH connection locally
ssh -i ~/.ssh/id_rsa user@your-server

# Test Uncloud CLI
uc ps
```

### Caddy Not Getting SSL Certificate

**Check:**
- DNS records point to your server
- Ports 80 and 443 are open
- Domain is accessible from internet

**Debug:**
```bash
# Check DNS
dig api.atlasmed.com

# Check port accessibility
telnet your-server 443

# View Caddy logs
uc logs <service> | grep caddy
```

### Container Won't Start

**Check:**
- Health check endpoint is working
- Environment variables are set
- Dependencies are available

**Debug:**
```bash
# View container logs
uc logs atlasmed-backend --tail 100

# SSH and check Docker
ssh user@server
docker ps -a
docker logs <container-id>
```

## Cost Breakdown

### Uncloud Setup (~$30-60/month)

**Single Server (Development/Small Production):**
- 1x DigitalOcean Droplet (4GB RAM, 2 vCPU): $24/month
- Includes: Backend + Web + Database
- **Total: $24/month**

**High Availability (Production):**
- 2x DigitalOcean Droplets (4GB RAM, 2 vCPU): $48/month
- Load balanced across regions
- **Total: $48/month**

### Comparison with Managed Platforms

| Platform | Monthly Cost | What's Included |
|----------|-------------|-----------------|
| **Uncloud** | $24-48 | Everything, unlimited traffic |
| Vercel Pro | $20 + usage | Web only, bandwidth limits |
| Railway | $5-20/service | Per service, usage-based |
| Fly.io | $10-40 | Usage-based pricing |

**Winner: Uncloud** for predictable costs and full control.

## Advanced: Multi-Region Deployment

```bash
# Add machines in different regions
uc machine add user@us-east-server
uc machine add user@eu-west-server
uc machine add user@asia-server

# Scale across regions
uc scale atlasmed-backend 3
uc scale atlasmed-web 3

# Uncloud distributes containers geographically
# Caddy load balances automatically
```

## Resources

- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Uncloud Docs**: https://uncloud.run/docs
- **Caddy Docs**: https://caddyserver.com/docs
- **Docker Compose**: https://docs.docker.com/compose

---

**Your CI/CD pipeline is now fully automated!** Every push to `main` automatically tests, builds, deploys, and provisions HTTPS for your application.
