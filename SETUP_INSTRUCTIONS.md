# AtlasMed Setup Instructions

## Prerequisites

- Bun runtime installed
- PostgreSQL running on localhost:5432
- Redis running on localhost:6379

## Initial Setup

### 1. Database Setup

```bash
# Navigate to database package
cd packages/database

# Run migrations
bunx prisma migrate dev

# Generate Prisma client
bunx prisma generate
```

### 2. Seed the Database

The seed script creates:
- 3 roles: ADMIN, MANAGER, USER
- Initial admin user

**Default Admin Credentials:**
- Email: `admin@atlasmed.com`
- Username: `admin`
- Password: `admin123456`

```bash
# From project root
cd apps/api
bun run db:seed
```

**Note:** Change the admin password immediately after first login!

### 3. Configure Environment Variables

**Backend (.env in apps/api/):**
```env
DATABASE_URL=postgresql://josepaulolaport:592jphlap@localhost:5432/atlasmed
REDIS_URL=redis://localhost:6379
JWT_SECRET=super-secret-jwt-key-change-in-production
RESEND_API_KEY=your_resend_api_key  # For email sending
TWILIO_ACCOUNT_SID=your_twilio_sid  # For WhatsApp
TWILIO_AUTH_TOKEN=your_twilio_token
```

**Frontend (.env.local in apps/web/):**
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=AtlasMed
```

### 4. Start the Backend API

```bash
cd apps/api
bun run dev
```

The API will be available at `http://localhost:3000`

### 5. Start the Frontend Web App

```bash
cd apps/web
bun run dev
```

The web app will be available at `http://localhost:3001` (or next available port)

## First Login

1. Navigate to `http://localhost:3001/login`
2. Login with:
   - **Identifier:** `admin` or `admin@atlasmed.com`
   - **Password:** `admin123456`
3. **IMPORTANT:** Change your password immediately!

## Next Steps

1. **Update Admin Password**
   - Go to Security Settings
   - Use the "Change Password" link

2. **Invite Users**
   - Navigate to Users → Invite User
   - Select a role (ADMIN, MANAGER, or USER)
   - Enter email address
   - User will receive an invitation email

3. **Configure Email & SMS**
   - Set up Resend API key for email sending
   - Set up Twilio for WhatsApp notifications
   - Update environment variables in `apps/api/.env`

## Testing

### Backend Tests

```bash
cd apps/api

# Run all tests
bun test

# Run unit tests only
bun run test:unit

# Run integration tests only
bun run test:integration

# Watch mode
bun run test:watch
```

### Seed Test Database

```bash
cd apps/api
bun run db:seed:test
```

## Troubleshooting

### Database Connection Issues

1. Verify PostgreSQL is running: `psql -U your_user -d postgres`
2. Check DATABASE_URL in .env file
3. Run migrations: `cd packages/database && bunx prisma migrate dev`

### Redis Connection Issues

1. Verify Redis is running: `redis-cli ping` (should return PONG)
2. Check REDIS_URL in .env file

### Seed Script Not Running

The seed script is NOT automatically run. You must run it manually:

```bash
cd apps/api
bun run db:seed
```

## Architecture

- **Backend**: Bun + Elysia.js (REST API)
- **Frontend**: Next.js 16 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Cache**: Redis
- **Queue**: BullMQ
- **Email**: Resend
- **SMS/WhatsApp**: Twilio

## Security Notes

- JWT tokens expire in 7 days (configurable)
- Access tokens refresh automatically
- Sessions are tracked with device fingerprinting
- Email and phone verification available
- Role-based access control (RBAC)
- Audit logging for all sensitive operations

## Production Deployment

1. Update all environment variables with production values
2. Change JWT_SECRET to a strong random value
3. Update SEED_ADMIN_PASSWORD before seeding
4. Configure proper CORS settings
5. Enable HTTPS
6. Set up proper database backups
7. Configure monitoring and alerting

## Support

For issues or questions, refer to:
- Backend README: `apps/api/README.md`
- Frontend README: `apps/web/README.md`
- Database README: `packages/database/README.md`
