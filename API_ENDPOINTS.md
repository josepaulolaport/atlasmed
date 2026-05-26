# AtlasMed API Endpoints

All endpoints are prefixed with `/access`

## Authentication Endpoints

### POST `/access/login`
- **Description**: Login with email, username, or phone number
- **Body**: `{ identifier: string, password: string }`
- **Response**: `{ session: { token: string }, user: User }`
- **Sets**: Refresh token in HTTP-only cookie

### POST `/access/logout`
- **Description**: Logout and revoke current session
- **Auth**: Required (Bearer token)
- **Response**: `{ message: string }`
- **Clears**: Refresh token cookie

### POST `/access/refresh`
- **Description**: Refresh access token using HTTP-only cookie
- **Body**: Optional `{ refreshToken?: string }` (falls back to cookie)
- **Response**: `{ session: { token: string }, user: User }`
- **Updates**: Refresh token cookie (token rotation)

### POST `/access/register`
- **Description**: Accept invite and register new user
- **Body**: `{ token: string, email: string, username: string, password: string, firstName?: string, lastName?: string, phoneNumber?: string }`
- **Response**: `{ session: { token: string }, user: User }`
- **Sets**: Refresh token cookie

### POST `/access/password-reset/request`
- **Description**: Request password reset code
- **Body**: `{ identifier: string }`
- **Response**: `{ message: string }`

### POST `/access/password-reset/confirm`
- **Description**: Reset password with code
- **Body**: `{ token: string, newPassword: string }`
- **Response**: `{ message: string }`

## User Profile Endpoints

### GET `/access/profile`
- **Description**: Get current user profile
- **Auth**: Required (Bearer token)
- **Response**: `User`

### PATCH `/access/profile`
- **Description**: Update current user profile
- **Auth**: Required (Bearer token)
- **Body**: `{ firstName?: string, lastName?: string, avatarUrl?: string }`
- **Response**: `User`

## Session Management

### GET `/access/sessions`
- **Description**: Get all user sessions
- **Auth**: Required (Bearer token)
- **Response**: `{ sessions: Session[] }`

### DELETE `/access/sessions/:id`
- **Description**: Revoke a specific session
- **Auth**: Required (Bearer token)
- **Response**: `{ message: string }`

## User Management (Admin/Manager)

### POST `/access/invite`
- **Description**: Invite new user
- **Auth**: Required (Bearer token + permission)
- **Permission**: `create:USER`
- **Body**: `{ email?: string, phoneNumber?: string, roleId: string }`
- **Response**: `Invitation`

### DELETE `/access/invites/:id`
- **Description**: Revoke an invitation
- **Auth**: Required (Bearer token + permission)
- **Permission**: `manage:USER`
- **Response**: `{ message: string }`

### POST `/access/users/:id/deactivate`
- **Description**: Deactivate a user account
- **Auth**: Required (Bearer token + permission)
- **Permission**: `manage:USER`
- **Response**: `User`

## Verification Endpoints

### POST `/access/verification/email/send`
- **Description**: Send email verification code
- **Auth**: Required (Bearer token)
- **Response**: `{ message: string }`

### POST `/access/verification/email/verify`
- **Description**: Verify email with code
- **Auth**: Required (Bearer token)
- **Body**: `{ code: string }`
- **Response**: `{ message: string }`

### POST `/access/verification/phone/send`
- **Description**: Send phone verification code
- **Auth**: Required (Bearer token)
- **Response**: `{ message: string }`

### POST `/access/verification/phone/verify`
- **Description**: Verify phone with code
- **Auth**: Required (Bearer token)
- **Body**: `{ code: string }`
- **Response**: `{ message: string }`

## Roles Endpoints

### GET `/access/roles`
- **Description**: Get all roles
- **Auth**: Required (Bearer token + permission)
- **Permission**: `read:USER`
- **Response**: `Role[]`

## Other Endpoints

### GET `/health`
- **Description**: Health check endpoint
- **Response**: `{ status: "ok", timestamp: string }`

### GET `/swagger`
- **Description**: Swagger UI documentation

### GET `/swagger/json`
- **Description**: OpenAPI JSON specification
