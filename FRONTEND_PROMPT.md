# Next.js Frontend Prompt for AtlasMed Healthcare Platform

## Project Overview
Build a modern, secure Next.js 14+ application with TypeScript that integrates with the AtlasMed backend API. The application must implement ALL authentication, user management, and security features that have been built in the backend.

## Tech Stack Requirements
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript (strict mode)
- **Styling:** Tailwind CSS + shadcn/ui components
- **State Management:** React Context + TanStack Query (React Query v5)
- **Form Handling:** React Hook Form + Zod validation
- **HTTP Client:** Axios with interceptors
- **Authentication:** JWT with refresh token rotation
- **Icons:** Lucide React
- **Toast Notifications:** sonner
- **Charts:** Recharts (for metrics dashboard)

## Backend API Overview

**Base URL:** `http://localhost:3000`

### Core Features

The backend includes comprehensive security features:
- Rate limiting (5 login attempts per 15 minutes)
- Account lockout on failed attempts
- Session hijacking detection
- IP address validation
- Device fingerprinting
- Comprehensive audit logging
- Email/phone verification workflows
- Background job processing with BullMQ
- Prometheus metrics
- Health checks

### Authentication & Session Endpoints

1. **POST /access/register** - Accept invite and register
   - Body: `{ token, email, phoneNumber?, username, password, firstName?, lastName? }`
   - Password must be minimum 8 characters
   - Returns: `{ user, message }`

2. **POST /access/login** - User login
   - Body: `{ identifier, password }` (identifier can be email/username/phone)
   - Returns: `{ accessToken, refreshToken, user }`
   - Rate limited: 5 attempts per 15 minutes per IP
   - Note: Failed attempts are tracked and logged

3. **POST /access/logout** - Logout current session
   - Requires: Bearer token
   - Body: `{ sessionId, userId, ipAddress? }`
   - Creates audit log entry

4. **POST /access/refresh** - Refresh access token
   - Body: `{ refreshToken }`
   - Returns: `{ accessToken, refreshToken, user }`
   - Implements session rotation

5. **GET /access/sessions** - Get all user sessions
   - Requires: Bearer token
   - Returns: Array of sessions with:
     - Device info (type, browser, OS)
     - IP address and geolocation
     - Last seen timestamp
     - Suspicious activity flag
     - Current session indicator

6. **DELETE /access/sessions/:id** - Revoke a specific session
   - Requires: Bearer token
   - Creates audit log entry
   - Updates metrics

### User Management Endpoints (Protected)

7. **POST /access/invite** - Invite new user (ADMIN/MANAGER only)
   - Body: `{ email?, phoneNumber?, roleId }`
   - Sends invitation via email/WhatsApp
   - Rate limited
   - Creates audit log

8. **POST /access/invite/:id/revoke** - Revoke invitation
   - Requires: Bearer token + ADMIN permission
   - Creates audit log

9. **GET /access/profile** - Get current user profile
   - Requires: Bearer token
   - Returns complete user profile with verification status

10. **PATCH /access/profile** - Update user profile
    - Body: `{ firstName?, lastName?, avatarUrl? }`
    - Requires: Bearer token

11. **GET /access/users** - List users (ADMIN/MANAGER only)
    - Query params: `?page=1&limit=10&status=ACTIVE&search=username`
    - Returns paginated user list

12-15. **User Status Management:**
    - `PUT /access/users/:id/deactivate` - Deactivate user
    - `PUT /access/users/:id/activate` - Activate user
    - `PUT /access/users/:id/suspend` - Suspend user
    - `PUT /access/users/:id/unsuspend` - Unsuspend user
    - All create audit logs and revoke sessions

### Password Management

16. **POST /access/password-reset/request** - Request password reset
    - Body: `{ identifier }` (email/phone/username)
    - Sends reset token via email/WhatsApp
    - Rate limited
    - Creates audit log

17. **POST /access/password-reset** - Complete password reset
    - Body: `{ token, password }`
    - Validates token
    - Creates audit log
    - Sends notification to user

### Email/Phone Verification Workflows

18. **POST /access/verification/email/request** - Request email verification
    - Requires: Bearer token
    - Sends verification token to user's email

19. **POST /access/verification/email/verify** - Verify email with token
    - Requires: Bearer token
    - Body: `{ token }`
    - Updates `emailVerified` and `emailVerifiedAt`

20. **POST /access/verification/phone/request** - Request phone verification
    - Requires: Bearer token
    - Sends 6-digit code via SMS

21. **POST /access/verification/phone/verify** - Verify phone with code
    - Requires: Bearer token
    - Body: `{ token }`
    - Updates `phoneVerified` and `phoneVerifiedAt`

22. **POST /access/verification/email/change** - Request email change
    - Requires: Bearer token
    - Body: `{ newEmail }`
    - Sends verification token to new email

23. **POST /access/verification/email/change/confirm** - Confirm email change
    - Requires: Bearer token
    - Body: `{ newEmail, token }`
    - Updates email and sets verified

24. **POST /access/verification/phone/change** - Request phone change
    - Requires: Bearer token
    - Body: `{ newPhone }`
    - Sends verification code to new phone

25. **POST /access/verification/phone/change/confirm** - Confirm phone change
    - Requires: Bearer token
    - Body: `{ newPhone, token }`
    - Updates phone and sets verified

### Health & Monitoring

26. **GET /health** - Comprehensive health check
    - Returns: `{ status, timestamp, uptime, checks: { database, redis, memory } }`

27. **GET /health/ready** - Readiness probe
    - Returns: `{ ready, checks: { database, redis } }`
    - 503 status if not ready

28. **GET /health/live** - Liveness probe
    - Returns: `{ alive, timestamp }`

29. **GET /health/metrics** - Prometheus metrics
    - Returns: Prometheus format metrics
    - Includes: HTTP metrics, active users/sessions, login attempts, etc.

## Key Features to Implement

### 1. Authentication Flow
- **Login Page:**
  - Email/username/phone + password
  - "Remember me" option
  - Show rate limit message after failed attempts
  - Show account lockout message
  - Link to forgot password

- **Registration Page:**
  - Validate invite token first
  - Show invite details (invited by, role)
  - Password strength indicator
  - Real-time validation
  - Terms of service checkbox

- **Forgot Password Flow:**
  - Request reset (email/phone/username)
  - Show success message (don't reveal if user exists)
  - Reset password page with token
  - Password strength meter
  - Redirect to login after success

- **JWT Token Management:**
  - Store accessToken in memory (React state/context)
  - Store refreshToken in httpOnly cookie (if possible) or secure localStorage
  - Implement auto-refresh before expiration (13 minutes timer)
  - Clear tokens on logout
  - Clear tokens on 401 errors
  - Retry failed requests after token refresh

### 2. Session Management Dashboard
- **Session List:**
  - Card/table view of all active sessions
  - Show for each session:
    - Device icon (Desktop/Mobile/Tablet)
    - Browser name + version
    - OS name
    - IP address
    - Country/city (if available)
    - Last seen (relative time: "5 minutes ago")
    - Created date
    - "Current session" badge
    - "Suspicious activity" warning badge
  - "Revoke" button for each session (except current)
  - Confirmation dialog before revoking
  - Auto-refresh every 30 seconds

- **Security Alerts Panel:**
  - Show sessions with suspicious activity
  - Highlight IP address changes
  - Show device changes
  - Quick action to revoke suspicious sessions

### 3. User Profile Management
- **Profile View:**
  - Avatar (with upload)
  - Full name (editable)
  - Email with verification badge
    - Green checkmark if verified
    - Yellow warning if not verified
    - "Verify Email" button if not verified
  - Phone with verification badge
    - Green checkmark if verified
    - Yellow warning if not verified
    - "Verify Phone" button if not verified
  - Username (read-only, with copy button)
  - Role badge
  - Account status badge
  - Member since date
  - Last login date

- **Email Verification Flow:**
  - Click "Verify Email" → API request → success toast
  - Check email for token
  - Enter token in dialog/page
  - Success message + badge update

- **Phone Verification Flow:**
  - Click "Verify Phone" → API request → success toast
  - Check SMS for 6-digit code
  - Enter code in dialog/page
  - Success message + badge update

- **Change Email:**
  - "Change Email" button
  - Modal/page with new email input
  - Send verification to new email
  - Enter token from email
  - Update profile + verified badge

- **Change Phone:**
  - "Change Phone" button
  - Modal/page with new phone input
  - Send verification SMS to new phone
  - Enter code from SMS
  - Update profile + verified badge

- **Change Password:**
  - Link to password change page
  - Current password required
  - New password with strength meter
  - Confirm new password
  - Show notification after change
  - Option to logout all other sessions

### 4. User Management (Admin/Manager Only)
- **User List Page:**
  - Data table with:
    - Avatar
    - Username
    - Email
    - Phone
    - Role badge
    - Status badge (ACTIVE/INACTIVE/SUSPENDED/PENDING)
    - Last login
    - Actions dropdown
  - Filters:
    - Status (all/active/inactive/suspended)
    - Role (all/admin/manager/user)
  - Search bar (username/email)
  - Pagination (10/25/50 per page)
  - Export to CSV button
  - Sorting by any column

- **User Actions Menu:**
  - View profile
  - View sessions
  - Activate/Deactivate
  - Suspend/Unsuspend
  - Change role (admin only)
  - View audit logs

- **Invite User:**
  - Floating action button "+"
  - Modal with form:
    - Email OR Phone (at least one required)
    - Role selection (dropdown)
    - Personal message (optional)
  - Show success toast with invite sent
  - Add to invitations list

- **Invitation Management:**
  - Separate tab/page for pending invitations
  - List showing:
    - Email/Phone
    - Role
    - Status (pending/accepted/expired/revoked)
    - Invited by
    - Expires at
    - Actions: Resend, Revoke
  - Filter by status
  - Auto-refresh expired invitations

### 5. Security Features UI
- **Password Requirements Display:**
  - Visual checklist during password entry:
    - ✅ Minimum 8 characters
    - ✅ At least one uppercase letter
    - ✅ At least one lowercase letter
    - ✅ At least one number
    - ✅ At least one special character
  - Password strength meter (weak/medium/strong)
  - Color-coded: red/yellow/green

- **Security Dashboard (User):**
  - Active sessions count
  - Recent suspicious activities
  - Recent login locations (map if possible)
  - Security score (based on 2FA, verified email/phone, etc.)
  - Recommendations:
    - "Enable 2FA"
    - "Verify your email"
    - "Verify your phone"
    - "Change password (last changed X days ago)"

- **Two-Factor Authentication Setup (Future):**
  - Enable 2FA toggle
  - QR code display for authenticator apps
  - Manual entry code
  - Verify with 6-digit code
  - Generate backup codes
  - Download backup codes
  - Show recovery options

### 6. Admin Dashboard/Home
- **Statistics Cards:**
  - Total users (with trend)
  - Active users (online now)
  - Pending invitations
  - Recent registrations (last 7 days)
  - Failed login attempts (last 24h)
  - Active sessions

- **Charts:**
  - User registrations over time (line chart)
  - Login activity (last 7 days)
  - User status breakdown (pie chart)
  - Role distribution (bar chart)

- **Recent Activity Feed:**
  - Recent user registrations
  - Recent logins
  - Recent password changes
  - Recent suspicious activities
  - User status changes
  - Each item with timestamp and user info

- **Quick Actions:**
  - Invite user button
  - View all sessions button
  - View audit logs button
  - System health button

### 7. Health Monitoring Page (Admin Only)
- **System Health Status:**
  - Overall status indicator (healthy/degraded/unhealthy)
  - Database status with latency
  - Redis status with latency
  - Memory usage progress bar
  - Uptime display

- **Metrics Dashboard:**
  - Active users gauge
  - Active sessions gauge
  - Login success rate (last hour)
  - Failed login attempts (last hour)
  - Password resets (last 24h)
  - API response times (P50, P95, P99)
  - Charts for all metrics over time

- **Background Jobs Status:**
  - Notification queue size
  - Cleanup jobs last run
  - Failed jobs count
  - Job processing rate

- **Real-time Updates:**
  - Auto-refresh every 10 seconds
  - WebSocket updates (optional)

### 8. Audit Log Viewer (Admin Only)
- **Audit Log Table:**
  - Columns:
    - Timestamp
    - Event type
    - Severity (INFO/WARNING/CRITICAL)
    - Actor (who performed the action)
    - Resource (what was affected)
    - Action (what was done)
    - IP address
    - Details (expandable)
  - Filters:
    - Date range picker
    - Event type multiselect
    - Severity filter
    - User filter
    - Search in details
  - Export to CSV
  - Pagination with infinite scroll option

- **Event Details Modal:**
  - Full event information
  - JSON view of metadata
  - Related events timeline
  - Link to affected user/resource

## Technical Implementation Requirements

### HTTP Client Setup (`lib/api/client.ts`)
```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  timeout: 10000,
});

// Request interceptor - attach token
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken(); // from context/localStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - handle errors & token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = getRefreshToken();
        const { data } = await axios.post('/access/refresh', { refreshToken });
        
        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken);
        
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed - logout user
        logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    // Handle 403 - unauthorized
    if (error.response?.status === 403) {
      toast.error('You do not have permission to perform this action');
    }

    // Handle 429 - rate limit
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      toast.error(`Too many requests. Please try again in ${retryAfter} seconds`);
    }

    // Handle 500 - server error
    if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later');
    }

    return Promise.reject(error);
  }
);
```

### Auth Context (`contexts/AuthContext.tsx`)
```typescript
interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  updateProfile: (data: ProfileUpdate) => Promise<void>;
  refreshToken: () => Promise<void>;
}

// Features:
// - Store user + tokens in state
// - Persist to localStorage/sessionStorage
// - Auto-refresh token before expiration (14min timer)
// - Clear tokens on logout
// - Restore session on page reload
```

### Protected Route Component
```typescript
// middleware.ts or components/ProtectedRoute.tsx
export function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return <LoadingSpinner />;
  
  if (!isAuthenticated) {
    redirect('/login');
  }

  if (requiredRole && user.role.name !== requiredRole) {
    return <UnauthorizedPage />;
  }

  return children;
}
```

### Form Validation Schemas (Zod)
```typescript
// Login
const loginSchema = z.object({
  identifier: z.string().min(1, 'Username/email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Register
const registerSchema = z.object({
  token: z.string(),
  email: z.string().email('Invalid email'),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain uppercase letter')
    .regex(/[a-z]/, 'Password must contain lowercase letter')
    .regex(/[0-9]/, 'Password must contain number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain special character'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

// Password Reset
const resetPasswordSchema = z.object({
  token: z.string(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
```

## UI/UX Guidelines
1. **Responsive Design:** Mobile-first, works on all screen sizes (320px+)
2. **Loading States:** Skeleton loaders, spinners for async operations
3. **Error Handling:** Toast notifications with clear, actionable messages
4. **Success Feedback:** Toast notifications + visual confirmation
5. **Accessibility:** ARIA labels, keyboard navigation, focus management, screen reader support
6. **Dark Mode:** Support system preference + manual toggle
7. **Form Validation:** Real-time validation with debouncing, error messages below fields
8. **Empty States:** Helpful illustrations and call-to-action when no data
9. **Animations:** Subtle transitions (fade, slide) using Framer Motion or CSS
10. **Typography:** Clear hierarchy, readable font sizes (16px base minimum)

## Component Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── layout.tsx (guest layout)
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── profile/page.tsx
│   │   ├── sessions/page.tsx
│   │   ├── security/page.tsx
│   │   ├── users/page.tsx (admin)
│   │   ├── invitations/page.tsx (admin)
│   │   ├── audit-logs/page.tsx (admin)
│   │   ├── health/page.tsx (admin)
│   │   └── layout.tsx (authenticated layout)
│   ├── unauthorized/page.tsx
│   └── layout.tsx (root layout)
├── components/
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── RegisterForm.tsx
│   │   ├── PasswordResetForm.tsx
│   │   └── PasswordStrengthMeter.tsx
│   ├── users/
│   │   ├── UserTable.tsx
│   │   ├── UserCard.tsx
│   │   ├── UserStatusBadge.tsx
│   │   ├── InviteUserDialog.tsx
│   │   └── UserActionsMenu.tsx
│   ├── sessions/
│   │   ├── SessionsList.tsx
│   │   ├── SessionCard.tsx
│   │   ├── RevokeSessionDialog.tsx
│   │   └── SessionDeviceIcon.tsx
│   ├── profile/
│   │   ├── ProfileForm.tsx
│   │   ├── ProfileAvatar.tsx
│   │   ├── VerificationBadge.tsx
│   │   ├── EmailVerificationDialog.tsx
│   │   ├── PhoneVerificationDialog.tsx
│   │   └── ChangePasswordDialog.tsx
│   ├── security/
│   │   ├── SecurityDashboard.tsx
│   │   ├── SecurityAlerts.tsx
│   │   ├── SecurityScore.tsx
│   │   └── RecentActivity.tsx
│   ├── health/
│   │   ├── HealthStatus.tsx
│   │   ├── MetricCard.tsx
│   │   ├── MetricChart.tsx
│   │   └── JobsStatus.tsx
│   ├── audit/
│   │   ├── AuditLogTable.tsx
│   │   ├── AuditLogFilters.tsx
│   │   └── AuditLogDetails.tsx
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── UserMenu.tsx
│   │   └── MobileNav.tsx
│   └── ui/ (shadcn components)
│       ├── button.tsx
│       ├── input.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── table.tsx
│       ├── badge.tsx
│       ├── toast.tsx
│       └── ... (other shadcn components)
├── contexts/
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useUsers.ts
│   ├── useSessions.ts
│   ├── useVerification.ts
│   ├── useAuditLogs.ts
│   └── useHealth.ts
├── lib/
│   ├── api/
│   │   ├── client.ts
│   │   ├── auth.ts
│   │   ├── users.ts
│   │   ├── sessions.ts
│   │   ├── verification.ts
│   │   ├── audit.ts
│   │   └── health.ts
│   └── utils/
│       ├── validators.ts
│       ├── formatters.ts
│       ├── permissions.ts
│       └── constants.ts
├── types/
│   ├── auth.ts
│   ├── user.ts
│   ├── session.ts
│   ├── audit.ts
│   └── api.ts
└── styles/
    └── globals.css
```

## Data Models (TypeScript Types)

```typescript
// User statuses
type UserStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING";

// Roles
type Role = "ADMIN" | "MANAGER" | "USER";

// Audit event types
type AuditEventType = 
  | "USER_LOGIN" | "USER_LOGOUT" | "USER_REGISTER"
  | "PASSWORD_CHANGE" | "PASSWORD_RESET_REQUEST" | "PASSWORD_RESET_COMPLETE"
  | "EMAIL_VERIFY" | "PHONE_VERIFY" | "EMAIL_CHANGE" | "PHONE_CHANGE"
  | "USER_DEACTIVATE" | "USER_ACTIVATE" | "USER_SUSPEND" | "USER_UNSUSPEND"
  | "ROLE_CHANGE" | "SESSION_REVOKE" | "SUSPICIOUS_ACTIVITY";

// Audit severity
type AuditSeverity = "INFO" | "WARNING" | "CRITICAL";

// User
interface User {
  id: string;
  username: string;
  email: string;
  phoneNumber?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  status: UserStatus;
  emailVerified: boolean;
  phoneVerified: boolean;
  emailVerifiedAt?: string;
  phoneVerifiedAt?: string;
  passwordChangedAt?: string;
  lastLoginAt?: string;
  role: {
    id: string;
    name: Role;
    description?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Session
interface Session {
  id: string;
  deviceType: "DESKTOP" | "MOBILE" | "TABLET" | "UNKNOWN";
  deviceName?: string;
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  ipAddress?: string;
  ipCountry?: string;
  ipCity?: string;
  lastSeenAt: string;
  createdAt: string;
  isCurrent: boolean;
  suspiciousActivity: boolean;
}

// Invitation
interface Invitation {
  id: string;
  email?: string;
  phoneNumber?: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  role: {
    id: string;
    name: Role;
  };
  expiresAt: string;
  acceptedAt?: string;
  revokedAt?: string;
  resendCount: number;
  lastResendAt?: string;
  createdAt: string;
}

// Audit Log
interface AuditLog {
  id: string;
  userId?: string;
  eventType: AuditEventType;
  severity: AuditSeverity;
  actor?: string;
  actorId?: string;
  resource?: string;
  resourceId?: string;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  outcome?: string;
  errorMessage?: string;
  createdAt: string;
}

// Health Check
interface HealthCheck {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: string; latency?: number };
    redis: { status: string; latency?: number };
    memory: { status: string; usage: number; limit: number };
  };
}
```

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=AtlasMed
```

## Design Considerations
1. **Color Scheme:**
   - Primary: Blue (#3B82F6) - trust, healthcare
   - Secondary: Green (#10B981) - health, success
   - Warning: Yellow (#F59E0B)
   - Danger: Red (#EF4444)
   - Neutral: Gray scale

2. **Trust Indicators:**
   - Verification badges (green checkmarks)
   - Security icons (shield, lock)
   - SSL badge in footer
   - Privacy policy link
   - Terms of service link

3. **Typography:**
   - Headings: Inter or Poppins (bold, 600)
   - Body: Inter or Open Sans (regular, 400)
   - Code: Fira Code or JetBrains Mono

4. **Spacing:**
   - Use Tailwind's spacing scale
   - Consistent padding (p-4, p-6, p-8)
   - Card spacing (gap-4, gap-6)

5. **Responsive Breakpoints:**
   - Mobile: 0-640px (sm)
   - Tablet: 641-1024px (md/lg)
   - Desktop: 1025px+ (xl/2xl)

## Priority Order for Implementation
1. **Week 1:**
   - Auth pages (login, register, forgot password)
   - Auth context + API client
   - Protected route wrapper
   - Basic layout (navbar, sidebar)

2. **Week 2:**
   - Profile page (view/edit)
   - Session management page
   - Email/phone verification dialogs
   - Change password

3. **Week 3:**
   - User management (admin)
   - Invitation system
   - User list with filters/search
   - User actions (activate/deactivate/suspend)

4. **Week 4:**
   - Security dashboard
   - Audit log viewer
   - Health monitoring (admin)
   - Metrics dashboard

5. **Polish & Testing:**
   - Dark mode
   - Animations
   - Loading states
   - Error boundaries
   - E2E tests

## Testing Requirements
- **Unit Tests:** React Testing Library for components
- **Integration Tests:** API integration with MSW (Mock Service Worker)
- **E2E Tests:** Playwright for critical flows (login, register, logout)
- **Accessibility Tests:** axe-core for a11y testing

## Additional Notes
- The backend uses rate limiting (5 login attempts per 15 minutes per IP)
- All protected endpoints require `Authorization: Bearer <token>` header
- Session tokens are valid for 7 days
- Access tokens expire in 15 minutes (must auto-refresh at 13-14 minutes)
- The backend has comprehensive audit logging for all security events
- The backend includes Prometheus metrics at `/health/metrics`
- BullMQ is used for background jobs (email/SMS queues, cleanup tasks)
- Redis is used for caching and rate limiting
- All security-sensitive actions create audit log entries
- Session hijacking detection is automatic (IP/device fingerprint changes)

## Expected Deliverables
1. Fully functional Next.js application
2. All features implemented and tested
3. Responsive design on all devices
4. Dark mode support
5. Loading and error states
6. Form validation
7. TypeScript throughout
8. Clean, maintainable code
9. README with setup instructions
10. Basic E2E tests for critical flows

Please build a production-ready Next.js application that implements ALL these features with clean, maintainable code following React and Next.js best practices. The application should feel professional, secure, and appropriate for a healthcare platform.

---

**Questions to Consider:**
1. Where should refresh tokens be stored? (localStorage vs httpOnly cookies)
2. Should we implement WebSockets for real-time updates?
3. Do we want to show a "session expired" modal or redirect immediately?
4. Should we implement optimistic updates for better UX?
5. Do we want to cache API responses with React Query?
6. Should we implement a "maintenance mode" page?
7. Do we want to show a "new version available" notification?

**Performance Targets:**
- Time to Interactive: < 3s
- First Contentful Paint: < 1.5s
- Lighthouse Score: > 90
- Bundle Size: < 500KB (initial)

**Browser Support:**
- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 10+)
