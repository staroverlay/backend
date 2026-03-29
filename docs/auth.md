# Auth Module

## Entities

### User
| Field | Type | Description |
| :--- | :--- | :--- |
| id | uuid | Primary key, auto-generated |
| email | text | Unique, required |
| passwordHash | text | Nullable (for OAuth accounts) |
| emailVerified | boolean | Default: false |
| emailVerificationCode | text | Nullable |
| emailVerificationExpiry | timestamp | Nullable |
| createdAt | timestamp | Auto-generated |
| updatedAt | timestamp | Auto-generated |

### Session
| Field | Type | Description |
| :--- | :--- | :--- |
| id | uuid | Primary key, auto-generated |
| userId | uuid | Foreign key to User |
| refreshTokenHash | text | Unique, hashed refresh token |
| ipAddress | text | Nullable |
| userAgent | text | Nullable |
| loginMethod | enum | "email", "oauth_twitch", "oauth_kick", "oauth_youtube" |
| expiresAt | timestamp | Expiration date |
| revokedAt | timestamp | Revocation date (if any) |
| createdAt | timestamp | Auto-generated |
| updatedAt | timestamp | Auto-generated |

## Endpoints

### Register
`POST /auth/register`
- **Body**: `{ email: string, password: string }`
- **Returns**: `{ success: true, userId: string, message: "Verification email sent" }`

### Verify Email
`POST /auth/verify-email`
- **Body**: `{ email: string, code: string }`
- **Returns**: `{ success: true, message: "Email verified" }`

### Resend Verification
`POST /auth/resend-verification`
- **Body**: `{ email: string }`
- **Returns**: `{ success: true, message: "Verification email resent" }`

### Login
`POST /auth/login`
- **Body**: `{ email: string, password: string }`
- **Returns**: `{ success: true, accessToken: string, refreshToken: string, user: User }`

### Refresh Token
`POST /auth/refresh`
- **Body**: `{ refreshToken: string }`
- **Returns**: `{ success: true, accessToken: string, refreshToken: string }`

### Logout
`POST /auth/logout`
- **Auth required**
- **Returns**: `{ success: true, message: "Logged out" }`

### Logout All Sessions
`POST /auth/logout-all`
- **Auth required**
- **Returns**: `{ success: true, message: "All sessions revoked" }`

### Change Password
`POST /auth/change-password`
- **Auth required**
- **Body**: `{ oldPassword: string, newPassword: string }`
- **Returns**: `{ success: true, message: "Password changed. All sessions revoked." }`

### Get Me
`GET /auth/me`
- **Auth required**
- **Returns**: `{ id: string, email: string, emailVerified: boolean, createdAt: string }`
