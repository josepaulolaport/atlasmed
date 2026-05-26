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
- Role-based access control (ADMIN, MANAGER, USER)

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
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Bun runtime installed
- Backend API running on `http://localhost:3000`

### Installation

```bash
# Install dependencies
cd apps/web
bun install
```

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=AtlasMed
```

### Development

```bash
# Start development server
bun dev

# Build for production
bun build

# Start production server
bun start
```

The application will be available at `http://localhost:3000`.

## Project Structure

```
apps/web/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Auth pages (login, register, etc.)
│   ├── (dashboard)/       # Protected dashboard pages
│   └── page.tsx           # Landing page
├── components/            # React components
│   ├── auth/              # Auth-related components
│   ├── layout/            # Layout components (navbar)
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
6. **Icons**: Use Lucide React icons

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
