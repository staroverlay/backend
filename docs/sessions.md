# Sessions Module

## Entities

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

### List Sessions
`GET /sessions/`
- **Auth required**
- **Returns**: `{ sessions: Session[] }`

### Revoke Session
`DELETE /sessions/:id`
- **Auth required**
- **Params**: `id` - The session ID to revoke
- **Returns**: `{ success: true, message: string }`
  - *Indicates whether the current session was revoked or another session.*
