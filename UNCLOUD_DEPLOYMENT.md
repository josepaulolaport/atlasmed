# Uncloud Deployment Guide

This guide covers deploying your AtlasMed monorepo to self-hosted infrastructure using **Uncloud**.

## What is Uncloud?

[Uncloud](https://uncloud.run/) is a self-hosting orchestration tool that gives you PaaS-like simplicity (like Heroku/Fly.io) while maintaining full control over your infrastructure. It includes:

- **Docker Compose workflow** - Deploy apps you already know how to build
- **Automatic HTTPS** - Built-in Caddy reverse proxy with Let's Encrypt
- **Zero-downtime deployments** - Rolling updates across machines
- **Multi-machine scaling** - Distribute your app across VMs/servers
- **No Kubernetes** - Simple, decentralized architecture

### Why Uncloud for AtlasMed?

- ✅ Self-hosted (full control over data and costs)
- ✅ Simple Docker Compose deployment
- ✅ Automatic HTTPS via Caddy (built-in)
- ✅ Scale across multiple VMs as you grow
- ✅ No vendor lock-in
- ✅ Perfect for solo developers

---

## Prerequisites

1. **Linux VMs/Servers** - One or more cloud VMs (DigitalOcean, Hetzner, AWS EC2, etc.) or bare metal
2. **SSH Access** - Root or sudo access to your machines
3. **Domain Names** - `atlasmed.com` and `api.atlasmed.com` pointing to your server IP
4. **Uncloud CLI** - Install locally: `curl -fsSL https://uncloud.run/install.sh | sh`

---

## Step 1: Prepare Your Machines

### Initialize Your First Machine

```bash
# SSH into your server and set it up for Uncloud
uc machine init [email protected]
```

This installs Uncloud on the machine and creates a WireGuard mesh network.

### (Optional) Add More Machines for High Availability

```bash
# Add additional machines to the cluster
uc machine add [email protected]
uc machine add [email protected]

# List all machines
uc machine ls
```

---

## Step 2: Configure Environment Variables

Uncloud reads environment variables from a `.env` file or you can set them per-deployment.

Create a production `.env` file (DO NOT commit this):

```bash
# .env.production (keep this file secret!)
DATABASE_URL=postgresql://user:pass@db-host:5432/atlasmed_prod
JWT_SECRET=your-super-secret-jwt-key-here
API_SECRET_KEY=your-api-secret-key-here
CORS_ORIGIN=https://atlasmed.com
```

Or set them in Uncloud directly:

```bash
uc env set DATABASE_URL "postgresql://..."
uc env set JWT_SECRET "your-secret"
uc env set CORS_ORIGIN "https://atlasmed.com"
```

---

## Step 3: Deploy the Backend

From your monorepo root:

```bash
# Build and deploy the backend with automatic HTTPS
cd backend

# Option 1: Deploy single container
uc run \
  --name atlasmed-backend \
  --port api.atlasmed.com:3001/https \
  --env-file ../.env.production \
  .

# Option 2: Use Docker Compose (recommended)
cd ..
uc compose up backend
```

Your backend API is now available at: **https://api.atlasmed.com**

Caddy automatically:
- Obtains SSL certificate from Let's Encrypt
- Proxies requests to your backend container
- Handles HTTPS redirects

---

## Step 4: Deploy the Web Frontend

```bash
# Deploy the Next.js web app
cd web

# Option 1: Deploy single container
uc run \
  --name atlasmed-web \
  --port atlasmed.com:3000/https \
  --port www.atlasmed.com:3000/https \
  --env-file ../.env.production \
  .

# Option 2: Use Docker Compose (recommended)
cd ..
uc compose up web
```

Your web app is now available at: **https://atlasmed.com**

---

## Step 5: Deploy Full Stack with Docker Compose

The easiest approach is deploying everything together:

```bash
# From monorepo root
uc compose up

# This deploys:
# - Backend at https://api.atlasmed.com
# - Web at https://atlasmed.com
# - Automatic HTTPS for both
# - Service discovery between containers
```

---

## Scaling Your Application

### Scale Horizontally (More Replicas)

```bash
# Scale backend to 3 replicas across machines
uc scale atlasmed-backend 3

# Scale web frontend to 2 replicas
uc scale atlasmed-web 2
```

Uncloud automatically:
- Distributes replicas across available machines
- Load balances traffic via Caddy
- Performs zero-downtime deployments

### Scale Vertically (Add More Machines)

```bash
# Add another machine to the cluster
uc machine add [email protected]

# Replicas will automatically distribute
```

---

## Updating Your Application

### Zero-Downtime Deployment

```bash
# Build and deploy new version
cd backend
uc run --name atlasmed-backend --port api.atlasmed.com:3001/https .

# Uncloud performs rolling update:
# 1. Starts new containers
# 2. Waits for health checks
# 3. Routes traffic to new containers
# 4. Stops old containers
```

### Rollback

```bash
# List previous versions
uc ps --history atlasmed-backend

# Rollback to previous version
uc rollback atlasmed-backend
```

---

## Monitoring & Management

### View Running Services

```bash
# List all services
uc ps

# View logs
uc logs atlasmed-backend
uc logs atlasmed-web --follow

# SSH into a specific machine
ssh [email protected]

# View container status
docker ps
```

### Health Checks

Health checks are defined in your `Dockerfile` and `docker-compose.yml`. Uncloud uses them to:
- Determine when a container is ready for traffic
- Restart unhealthy containers
- Perform safe rolling updates

---

## CI/CD Integration with Uncloud

Update your GitHub Actions workflows to deploy via Uncloud:

### Backend CI/CD

Edit `.github/workflows/backend-ci.yml`:

```yaml
deploy:
  name: Deploy Backend via Uncloud
  needs: test
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Install Uncloud CLI
      run: curl -fsSL https://uncloud.run/install.sh | sh
    
    - name: Setup SSH for Uncloud
      run: |
        mkdir -p ~/.ssh
        echo "${{ secrets.UNCLOUD_SSH_KEY }}" > ~/.ssh/id_rsa
        chmod 600 ~/.ssh/id_rsa
        ssh-keyscan ${{ secrets.UNCLOUD_HOST }} >> ~/.ssh/knownhosts
    
    - name: Deploy Backend
      working-directory: ./backend
      env:
        DATABASE_URL: ${{ secrets.DATABASE_URL }}
        JWT_SECRET: ${{ secrets.JWT_SECRET }}
      run: |
        uc run \
          --name atlasmed-backend \
          --port api.atlasmed.com:3001/https \
          --env DATABASE_URL="$DATABASE_URL" \
          --env JWT_SECRET="$JWT_SECRET" \
          .
```

### Web CI/CD

Edit `.github/workflows/web-ci.yml`:

```yaml
deploy:
  name: Deploy Web via Uncloud
  needs: test
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Install Uncloud CLI
      run: curl -fsSL https://uncloud.run/install.sh | sh
    
    - name: Setup SSH for Uncloud
      run: |
        mkdir -p ~/.ssh
        echo "${{ secrets.UNCLOUD_SSH_KEY }}" > ~/.ssh/id_rsa
        chmod 600 ~/.ssh/id_rsa
    
    - name: Deploy Web
      working-directory: ./web
      env:
        NEXT_PUBLIC_API_URL: https://api.atlasmed.com
      run: |
        uc run \
          --name atlasmed-web \
          --port atlasmed.com:3000/https \
          --env NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
          .
```

### Required GitHub Secrets

- `UNCLOUD_SSH_KEY` - Private SSH key for accessing your Uncloud machines
- `UNCLOUD_HOST` - IP or hostname of your primary Uncloud machine
- Plus all your existing app secrets (DATABASE_URL, JWT_SECRET, etc.)

---

## Cost Comparison

### Uncloud (Self-Hosted)

**Example: DigitalOcean Droplets**
- 1x $12/month (2GB RAM, 1 vCPU) for backend
- 1x $18/month (4GB RAM, 2 vCPU) for web + database
- **Total: ~$30/month** for production-ready setup

**Scale up:**
- 3x $18 droplets = $54/month for multi-region HA setup

### Managed Platforms (For Comparison)

- **Vercel**: $20/month (Pro) + usage
- **Railway**: ~$5-10/month per service
- **Fly.io**: ~$10-30/month depending on resources

**Winner**: Uncloud is more predictable and cheaper at scale.

---

## Advanced Configuration

### Adding a Database

Add to `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: atlasmed
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    networks:
      - atlasmed-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
```

### Adding Redis Cache

```yaml
services:
  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    networks:
      - atlasmed-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

volumes:
  redis-data:
```

---

## Troubleshooting

### Caddy Not Getting SSL Certificate

```bash
# Check Caddy logs
uc logs atlasmed-backend | grep caddy

# Ensure DNS is pointing to your server
dig api.atlasmed.com

# Verify port 80/443 are open
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Container Won't Start

```bash
# View detailed logs
uc logs atlasmed-backend --tail 100

# SSH into machine and check Docker
ssh [email protected]
docker ps -a
docker logs <container-id>
```

### Service Discovery Issues

```bash
# Services communicate using container names
# Backend can reach database at: postgres:5432
# Web can reach backend at: backend:3001
```

---

## Quick Reference

```bash
# Deploy
uc compose up
uc run --name app --port domain.com:8000/https .

# Scale
uc scale app 3

# Update
uc compose up --pull

# Logs
uc logs app --follow

# Machines
uc machine ls
uc machine add host
uc machine remove host

# Cleanup
uc compose down
uc prune
```

---

## Resources

- **Uncloud Docs**: https://uncloud.run/docs
- **Uncloud GitHub**: https://github.com/uncloud/uncloud
- **Discord Community**: https://uncloud.run/discord
- **Caddy Docs**: https://caddyserver.com/docs/

---

## Next Steps

1. Set up your first VM and initialize Uncloud
2. Deploy backend and web using `uc compose up`
3. Configure DNS to point to your server
4. Test HTTPS automatic certificate issuance
5. Scale to multiple machines as traffic grows

Uncloud + Caddy gives you production-grade infrastructure without the complexity!
