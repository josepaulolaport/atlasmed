# AtlasMed Web Application

A production-ready Next.js frontend application for the AtlasMed healthcare management platform.

## Features

### Authentication & Security

- User login with email/username/phone
- Registration via invitation token
- Password reset flow
- JWT token management with automatic refresh
- Session management and device tracking
- Email and phone verification
- Role-based access control (ADMIN, MANAGER, REP, OPS)

### User Management (Admin/Manager)

- User list with search and filtering
- Invite new users
- Activate/Deactivate/Suspend users
- View user details and verification status

### Profile & Security

- Profile view and edit
- Email and phone verification badges
- Security score dashboard
- Active session management with device info
- Revoke suspicious sessions

### System Monitoring (Admin)

- Health status dashboard
- Database and Redis status
- Memory usage monitoring
- Application metrics (active users, sessions, login rates)
- Real-time updates

## Technology Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: TailwindCSS 4 + Radix UI
- **Forms**: React Hook Form + Zod
- **HTTP Client**: Axios with interceptors
- **State Management**: React Context API
- **Icons**: `iconify-icon` web component (Solar linear set)

## Getting Started

### Prerequisites

- Bun runtime installed.
- Backend API running (default `http://localhost:3000` — start API on another port if running both locally).

### Installation

```bash
cd apps/web && bun install
```

### Environment

Create `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=AtlasMed
```

Additional variables — see `apps/web/.env.local.example` for the current full list; only the ones above are required for local dev.

### Commands

| Command | Purpose |
|---|---|
| `bun dev` | Dev server |
| `bun run build` | Production build |
| `bun start` | Serve production build |
| `bun run lint` | ESLint |

If running the API on `3000`, start web on a different port: `PORT=3001 bun dev`.

### Rules

- Do NOT commit `.env.local`.
- Do NOT hardcode the API URL in code — always go through `NEXT_PUBLIC_API_URL`.
- Do NOT default `NEXT_PUBLIC_API_URL` in production builds — CI must inject it explicitly.

## Project Structure

```
apps/web/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Auth pages (login, register, etc.)
│   ├── (dashboard)/       # Protected dashboard pages
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── auth/              # Auth-related components
│   ├── layout/            # Layout components (sidebar, top-header)
│   └── ui/                # Reusable UI components
├── contexts/              # React contexts
│   └── auth-context.tsx   # Authentication state
├── hooks/                 # Custom React hooks
│   └── use-toast.ts       # Toast notifications
├── lib/                   # Utility libraries
│   ├── api/               # API client functions
│   ├── permissions.ts     # Permission helpers
│   ├── utils.ts           # Utility functions
│   └── validators.ts      # Zod schemas
└── types/                 # TypeScript types
    ├── auth.ts            # Auth-related types
    └── api.ts             # API response types
```

## Features by Role

### USER

- View and edit profile
- Manage sessions
- Verify email and phone
- View security dashboard

### MANAGER

- All USER features
- View user list
- Invite new users
- Activate/deactivate users

### ADMIN

- All MANAGER features
- System health monitoring
- View application metrics
- Full user management

## API Integration

The application connects to the backend API at the configured `NEXT_PUBLIC_API_URL`. All API calls include:

- Automatic JWT token refresh
- Error handling with toast notifications
- Request/response interceptors
- Rate limiting detection

## Security Features

- JWT-based authentication
- Automatic token refresh before expiration
- Session tracking with device fingerprinting
- Email and phone verification
- Password strength requirements
- Role-based access control
- Protected routes
- Suspicious activity detection

## UI/UX Features

- Responsive design (mobile-first)
- Loading states and skeletons
- Error handling with toast notifications
- Success feedback
- Accessibility support (ARIA labels)
- Dark mode ready
- Form validation with real-time feedback

## Development Guidelines

1. **Components**: Use the provided UI components in `components/ui/`
2. **Forms**: Use React Hook Form with Zod validation
3. **API Calls**: Use the API client functions in `lib/api/`
4. **State**: Use the AuthContext for auth state
5. **Styling**: Use TailwindCSS utility classes
6. **Icons**: Use `iconify-icon` with Solar linear icon set (`solar:xxx-linear`, `stroke-width="1.5"`)

## Production Deployment

The application is configured for Docker deployment with standalone output:

```bash
# Build Docker image
docker build -t atlasmed-web .

# Run container
docker run -p 3000:3000 atlasmed-web
```

## License

Proprietary - AtlasMed Healthcare Management System
