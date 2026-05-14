# Deployment & Secrets Management Guide

This guide explains how to securely manage environment variables across development and production environments.

## Overview

- **Development**: Use local `.env` files (gitignored)
- **CI/CD**: Use GitHub Secrets
- **Production Runtime**: Use deployment platform secrets

**NEVER commit `.env`, `.env.local`, or any file containing real secrets to git.**

---

## 1. Development Environment Setup

### Backend

1. Copy the example file:
```bash
cd backend
cp .env.example .env
```

2. Edit `backend/.env` with your local development values
3. The `.env` file is already in `.gitignore` and won't be committed

### Web App

1. Copy the example file:
```bash
cd web
cp .env.local.example .env.local
```

2. Edit `web/.env.local` with your local development values
3. Next.js automatically loads `.env.local` for development

### Mobile App

1. Copy the example file:
```bash
cd mobile
cp .env.example .env
```

2. Install flutter_dotenv (if not already):
```bash
flutter pub add flutter_dotenv
```

3. Edit `mobile/.env` with your local development values

---

## 2. GitHub Secrets (for CI/CD)

GitHub Secrets are encrypted environment variables that are only exposed during CI/CD workflows. Nobody can view them after they're set, not even repository admins.

### How to Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add secrets for each environment variable

### Recommended Secrets

#### Backend Secrets
```
BACKEND_DATABASE_URL=<production-database-url>
BACKEND_JWT_SECRET=<strong-random-secret>
BACKEND_API_KEY=<production-api-key>
```

#### Web Secrets
```
WEB_API_SECRET_KEY=<production-secret>
WEB_DATABASE_URL=<production-database-url>
NEXT_PUBLIC_API_URL=<production-api-url>
```

#### Mobile Secrets
```
MOBILE_API_BASE_URL=<production-api-url>
MOBILE_GOOGLE_SERVICES_JSON=<base64-encoded-google-services>
```

#### Deployment Platform Secrets
```
# Railway
RAILWAY_TOKEN=<your-railway-token>

# Fly.io
FLY_API_TOKEN=<your-fly-token>

# Vercel
VERCEL_TOKEN=<your-vercel-token>
VERCEL_ORG_ID=<your-org-id>
VERCEL_PROJECT_ID=<your-project-id>

# Google Play / App Store
ANDROID_KEYSTORE=<base64-encoded-keystore>
ANDROID_KEYSTORE_PASSWORD=<keystore-password>
IOS_CERTIFICATE=<base64-encoded-cert>
FASTLANE_PASSWORD=<apple-id-password>
```

### Using Secrets in GitHub Actions

The secrets are already configured in your workflows. Here's how they work:

**Backend CI/CD** (`.github/workflows/backend-ci.yml`):
```yaml
- name: Deploy to Railway
  env:
    RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
    DATABASE_URL: ${{ secrets.BACKEND_DATABASE_URL }}
    JWT_SECRET: ${{ secrets.BACKEND_JWT_SECRET }}
  run: railway up
```

**Web CI/CD** (`.github/workflows/web-ci.yml`):
```yaml
- name: Deploy to Vercel
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
    VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
    VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
  run: vercel deploy --prod
```

---

## 3. Deployment Platform Secrets

Each deployment platform has its own way to manage production environment variables at runtime.

### Railway

1. Go to your project dashboard
2. Click on **Variables** tab
3. Add environment variables directly in the dashboard
4. Railway automatically injects them at runtime

**CLI Method:**
```bash
railway variables set DATABASE_URL=<value>
railway variables set JWT_SECRET=<value>
```

### Fly.io

1. Use the Fly.io CLI to set secrets:
```bash
cd backend
flyctl secrets set DATABASE_URL=<value>
flyctl secrets set JWT_SECRET=<value>
```

2. Secrets are encrypted and injected at runtime
3. View secret names (not values): `flyctl secrets list`

### Vercel (for Next.js)

**Dashboard Method:**
1. Go to your project settings
2. Navigate to **Environment Variables**
3. Add variables for Production, Preview, and Development
4. Choose which environments each variable applies to

**CLI Method:**
```bash
vercel env add DATABASE_URL production
# You'll be prompted to enter the value securely
```

**Important for Next.js:**
- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
- Variables without the prefix are server-side only
- Set them in Vercel dashboard for each environment

### Netlify

1. Go to **Site settings** → **Environment variables**
2. Add variables with scopes (Production, Deploy Preview, Branch deploys)
3. Netlify automatically injects them during build and runtime

---

## 4. Mobile App Secrets

Mobile apps are more complex because secrets need to be injected at build time.

### Option 1: GitHub Actions with --dart-define (Recommended)

Update `.github/workflows/mobile-ci.yml`:

```yaml
- name: Build APK with secrets
  env:
    API_BASE_URL: ${{ secrets.MOBILE_API_BASE_URL }}
  run: |
    flutter build apk --release \
      --dart-define=API_BASE_URL=$API_BASE_URL \
      --dart-define=APP_ENV=production
  working-directory: ./mobile
```

Access in Dart code:
```dart
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://localhost:3001',
);
```

### Option 2: flutter_dotenv with Build-Time Injection

In CI/CD, create the `.env` file from secrets:

```yaml
- name: Create production .env
  run: |
    echo "API_BASE_URL=${{ secrets.MOBILE_API_BASE_URL }}" > mobile/.env
    echo "APP_ENV=production" >> mobile/.env

- name: Build APK
  run: flutter build apk --release
  working-directory: ./mobile
```

### Option 3: Firebase Remote Config (Runtime Secrets)

For secrets that can change without rebuilding:
1. Store non-sensitive config in Firebase Remote Config
2. Fetch at runtime
3. Use for API URLs, feature flags, etc.

**Never** store truly sensitive secrets (API keys, tokens) in the app binary or Firebase Remote Config. Use a backend proxy instead.

---

## 5. Security Best Practices

### ✅ DO

- Use `.env.example` files with dummy values to document required variables
- Store production secrets in GitHub Secrets and deployment platforms
- Use different secrets for development, staging, and production
- Rotate secrets regularly
- Use strong, randomly generated secrets (e.g., `openssl rand -base64 32`)
- Limit secret access to only the services that need them
- Use secret scanning tools (GitHub has this built-in)

### ❌ DON'T

- Commit `.env`, `.env.local`, `.env.production` to git
- Share secrets via Slack, email, or other messaging apps
- Use weak or default secrets in production
- Hardcode secrets in source code
- Log secrets to console or files
- Include secrets in client-side code (mobile/web frontend)

---

## 6. Verifying Your Setup

### Check .gitignore Coverage

Run this to ensure no secrets are tracked:
```bash
git ls-files | grep -E "\.env$|\.env\.local$|\.env\.production$"
```

This should return nothing. If it shows files, remove them:
```bash
git rm --cached <filename>
git commit -m "Remove accidentally committed secrets"
```

### Test Local Development

```bash
# Backend
cd backend
bun run dev  # Should load from .env

# Web
cd web
bun run dev  # Should load from .env.local

# Mobile
cd mobile
flutter run  # Should load from .env (if using flutter_dotenv)
```

### Test CI/CD (Safe Test)

1. Add a test secret to GitHub: `TEST_SECRET=hello`
2. Update a workflow to echo it: `echo "Secret: ${{ secrets.TEST_SECRET }}"`
3. Push a change and verify in Actions logs
4. Remove the test after verification

---

## 7. Quick Setup Checklist

- [ ] Create local `.env` files from `.env.example` templates
- [ ] Add all `.env*` files to `.gitignore` (already done)
- [ ] Set up GitHub Secrets for CI/CD
- [ ] Configure deployment platform secrets
- [ ] Update CI/CD workflows with secret references
- [ ] Test local development with `.env` files
- [ ] Test a deployment to verify secrets work
- [ ] Document any custom secrets in your team wiki

---

## 8. Example Workflow Updates

### Backend Deployment (Railway Example)

Edit `.github/workflows/backend-ci.yml`:

```yaml
deploy:
  name: Deploy Backend
  needs: test
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Install Railway CLI
      run: npm install -g @railway/cli
    
    - name: Deploy to Railway
      working-directory: ./backend
      env:
        RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
      run: railway up --service backend
```

### Web Deployment (Vercel Example)

Edit `.github/workflows/web-ci.yml`:

```yaml
deploy:
  name: Deploy Web App
  needs: test
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main' && github.event_name == 'push'
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
    
    - name: Deploy to Vercel
      uses: amondnet/vercel-action@v25
      with:
        vercel-token: ${{ secrets.VERCEL_TOKEN }}
        vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
        vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
        working-directory: ./web
        vercel-args: '--prod'
      env:
        # These will be set in Vercel dashboard, not here
        # NEXT_PUBLIC_API_URL is configured in Vercel
```

---

## Need Help?

- **GitHub Secrets**: [GitHub Docs](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- **Railway Secrets**: [Railway Docs](https://docs.railway.app/develop/variables)
- **Vercel Env Variables**: [Vercel Docs](https://vercel.com/docs/concepts/projects/environment-variables)
- **Fly.io Secrets**: [Fly.io Docs](https://fly.io/docs/reference/secrets/)
