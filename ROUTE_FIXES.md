# Backend Route Fixes

## Routes Fixed

The following backend routes have been updated to match frontend expectations:

### 1. Login Route
- **Old:** `POST /access/password`
- **New:** `POST /access/login` ✅
- **File:** `apps/api/src/modules/access/infrastructure/routes/login.route.ts`

### 2. Profile Routes
- **Old:** `GET /access/me`
- **New:** `GET /access/profile` ✅
- **New:** `PATCH /access/profile` ✅ (added)
- **File:** `apps/api/src/modules/access/infrastructure/routes/profile.route.ts`

### 3. Invite Route
- **Old:** `POST /access/invites`
- **New:** `POST /access/invite` ✅
- **File:** `apps/api/src/modules/access/infrastructure/routes/invite-user.route.ts`

### 4. CORS Configuration
- Added CORS middleware with proper headers ✅
- Allows credentials (cookies, JWT tokens) ✅
- Handles OPTIONS preflight requests ✅
- **File:** `apps/api/src/app/app.ts`

## Routes That Already Match

These routes already match the frontend expectations:

- `POST /access/register` ✅
- `POST /access/logout` ✅
- `POST /access/refresh` ✅
- `GET /access/sessions` ✅
- `DELETE /access/sessions/:id` ✅
- `POST /access/password-reset/request` ✅
- `POST /access/password-reset` ✅
- `POST /access/verification/email/request` ✅
- `POST /access/verification/email/verify` ✅
- `POST /access/verification/phone/request` ✅
- `POST /access/verification/phone/verify` ✅
- User management routes (activate, deactivate, etc.) ✅

## Expected API Endpoints (Frontend → Backend)

```
Authentication:
POST   /access/login                     → Login with credentials
POST   /access/register                  → Accept invite and register
POST   /access/logout                    → Logout current session
POST   /access/refresh                   → Refresh access token
POST   /access/password-reset/request    → Request password reset
POST   /access/password-reset            → Reset password with token

Profile:
GET    /access/profile                   → Get current user profile
PATCH  /access/profile                   → Update profile

Sessions:
GET    /access/sessions                  → Get all user sessions
DELETE /access/sessions/:id              → Revoke a session

User Management (Admin/Manager):
POST   /access/invite                    → Invite new user
POST   /access/invite/:id/revoke         → Revoke invitation
GET    /access/users                     → List users (with pagination)
PUT    /access/users/:id/deactivate      → Deactivate user
PUT    /access/users/:id/activate        → Activate user
PUT    /access/users/:id/suspend         → Suspend user
PUT    /access/users/:id/unsuspend       → Unsuspend user

Verification:
POST   /access/verification/email/request        → Request email verification
POST   /access/verification/email/verify         → Verify email with token
POST   /access/verification/phone/request        → Request phone verification
POST   /access/verification/phone/verify         → Verify phone with code
POST   /access/verification/email/change         → Request email change
POST   /access/verification/email/change/confirm → Confirm email change
POST   /access/verification/phone/change         → Request phone change
POST   /access/verification/phone/change/confirm → Confirm phone change

Health:
GET    /health                           → System health check
GET    /health/ready                     → Readiness probe
GET    /health/live                      → Liveness probe
GET    /health/metrics                   → Prometheus metrics
```

## Auto-Reload

The backend uses `bun --watch` which automatically reloads when files change. 

**No manual restart needed!** Changes are applied automatically.

## Testing

After the changes, try logging in from the frontend:

1. Go to `http://localhost:3001/login`
2. Enter credentials:
   - Username: `admin`
   - Password: `admin123456`
3. Click "Sign in"

The CORS and route path issues should now be resolved! ✅
