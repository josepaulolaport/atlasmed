# 🚀 AtlasMed API v1 Migration Guide

The API has been upgraded to use versioned URLs. All endpoints now require `/api/v1` prefix.

## ✅ Changes Already Applied

The following files have been automatically updated:

### 1. Web App (Frontend)

**Updated Files:**
- ✅ `apps/web/.env.local` - API URL updated to include `/api/v1`
- ✅ `apps/web/.env.local.example` - Example updated with new URLs
- ✅ `apps/web/lib/api/health.ts` - Separate client for health endpoints

**Changes:**
```bash
# Before
NEXT_PUBLIC_API_URL=http://localhost:3000

# After  
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_HEALTH_URL=http://localhost:3000
```

### 2. API Routes

All routes now follow this structure:

| Route Type | Old URL | New URL |
|------------|---------|---------|
| **API Routes** | `/access/login` | `/api/v1/access/login` |
| **API Routes** | `/access/users` | `/api/v1/access/users` |
| **Health Routes** | `/health` | `/health` (unchanged) |
| **Health Routes** | `/health/ready` | `/health/ready` (unchanged) |

---

## 🎯 What You Need To Do

### Step 1: Restart Your Services

```bash
# Terminal 1: Restart API
cd apps/api
bun run dev

# Terminal 2: Restart Web App
cd apps/web
bun run dev
```

### Step 2: Test the Changes

#### A. Test API Directly

```bash
# 1. Test health endpoint (no version)
curl http://localhost:3000/health

# 2. Test login (with version)
curl -X POST http://localhost:3000/api/v1/access/login \
  -H "Content-Type: application/json" \
  -d '{
    "identifier": "admin@atlasmed.com",
    "password": "your-password"
  }'
```

#### B. Test Web App

1. Open browser: `http://localhost:3001`
2. Try to login
3. Check browser console for any errors
4. Verify API calls are going to `/api/v1/access/*`

### Step 3: Check Browser Network Tab

Open DevTools → Network and verify:

✅ API calls go to: `http://localhost:3000/api/v1/access/*`  
✅ Health calls go to: `http://localhost:3000/health`  
✅ No 404 errors  
✅ Authentication works  

---

## 🔧 Additional Updates Needed

### If You Have Mobile App

Update the base URL in your mobile app:

**iOS (Swift):**
```swift
// Before
let baseURL = "http://localhost:3000"

// After
let baseURL = "http://localhost:3000/api/v1"
```

**Android (Kotlin):**
```kotlin
// Before
const val BASE_URL = "http://localhost:3000"

// After  
const val BASE_URL = "http://localhost:3000/api/v1"
```

### If You Have Postman/Insomnia

Update your collections:

1. Open your collection
2. Update base URL variable:
   ```
   {{base_url}}/api/v1
   ```
3. Keep health endpoints without version:
   ```
   {{base_url}}/health
   ```

### If You Have Tests

Update test URLs:

```typescript
// Before
const API_URL = 'http://localhost:3000';

// After
const API_URL = 'http://localhost:3000/api/v1';
```

### If You Have CI/CD

Update environment variables in:

- GitHub Actions secrets
- Vercel environment variables
- Netlify environment variables
- Docker compose files
- Kubernetes configs

**Example:**
```yaml
# .github/workflows/deploy.yml
env:
  API_URL: https://api.atlasmed.com/api/v1  # Add /api/v1
```

---

## 📊 Testing Checklist

Use this checklist to verify everything works:

### API (Backend)

- [ ] `bun run typecheck` passes
- [ ] `bun run dev` starts without errors
- [ ] Health endpoint works: `curl http://localhost:3000/health`
- [ ] Swagger UI accessible: `http://localhost:3000/swagger`
- [ ] Login endpoint works: `POST /api/v1/access/login`

### Web App (Frontend)

- [ ] Web app starts: `bun run dev`
- [ ] Login page loads
- [ ] Can login successfully
- [ ] Dashboard loads after login
- [ ] No console errors
- [ ] Network tab shows correct URLs (`/api/v1/access/*`)

### Integration

- [ ] Login flow works end-to-end
- [ ] Token refresh works automatically
- [ ] Logout works
- [ ] Protected routes redirect to login
- [ ] API errors display correctly

---

## 🐛 Troubleshooting

### Problem: "404 Not Found" when calling API

**Cause:** Using old URL without `/api/v1` prefix

**Solution:**
```typescript
// Wrong
fetch('http://localhost:3000/access/login')

// Correct
fetch('http://localhost:3000/api/v1/access/login')
```

### Problem: Health endpoint returns 404

**Cause:** Trying to use version prefix for health endpoints

**Solution:**
```typescript
// Wrong
fetch('http://localhost:3000/api/v1/health')

// Correct
fetch('http://localhost:3000/health')
```

### Problem: Web app can't connect to API

**Cause:** `.env.local` not updated or not loaded

**Solution:**
1. Check `.env.local` has the new URL
2. Restart the web app: `Ctrl+C` then `bun run dev`
3. Clear browser cache
4. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)

### Problem: CORS errors in browser

**Cause:** Web app might be on different port

**Solution:**
Check API CORS configuration in `apps/api/src/app/app.ts`:
```typescript
cors({
  origin: environment.CORS_ORIGINS,
  credentials: true
})
```

Make sure your web app URL is in `CORS_ORIGINS` in `.env`.

---

## 📚 Documentation

For more details, see:

- [Phase 3 Complete Summary](./atlasmed/apps/api/PHASE3_COMPLETE.md)
- [Phase 3 Implementation Details](./atlasmed/apps/api/docs/PHASE3_IMPLEMENTATION.md)
- [API Documentation](http://localhost:3000/swagger) (after starting API)
- [Error Codes Reference](./atlasmed/apps/api/docs/ERROR_CODES.md)
- [Observability Setup Guide](./atlasmed/apps/api/OBSERVABILITY_SETUP.md)
- [Observability Quick Start](./atlasmed/apps/api/OBSERVABILITY_QUICK_START.md)

---

## 🎉 Benefits of This Change

### For Developers

✅ **Clear Versioning** - API version explicit in URL  
✅ **Better Documentation** - Swagger shows version info  
✅ **Future-Proof** - Can deploy v2 alongside v1  
✅ **Easier Debugging** - Version visible in logs  

### For Operations

✅ **Safe Deployments** - Breaking changes go to v2  
✅ **Gradual Migration** - Both versions can run simultaneously  
✅ **Clear Deprecation** - Old versions have sunset dates  
✅ **Better Monitoring** - Version in metrics  

---

## ❓ Need Help?

If you encounter issues:

1. **Check this guide** for common problems
2. **Review the logs** in both API and web app
3. **Check browser console** for frontend errors
4. **Verify environment variables** are loaded
5. **Restart both services** to pick up changes

---

**Migration Status:**  
✅ Backend API updated  
✅ Frontend web app updated  
⏳ Your turn: Restart services and test

**Last Updated:** May 25, 2026
