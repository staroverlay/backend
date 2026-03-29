# OAuth Module

## Entities
*No specific database entities for the OAuth module, although results are often tied back to `integrations` or `users`.*

## Endpoints

### Single Provider OAuth Route
The providers supported are: `twitch`, `kick`, `youtube`.

---

### Initiate Login
`POST /oauth/login/:provider`
- **Params**: `provider` (one of "twitch", "kick", "youtube")
- **Returns**: `{ url: string, state: string }`
  - *The client should redirect the user to this URL.*

### OAuth Callback
`GET /oauth/callback/:provider`
- **Params**: `provider`
- **Query**: `{ code: string, state: string, error?: string }`
- **Returns (on success - Login flow)**: `{ success: true, accessToken: string, refreshToken: string, user: User }`
- **Returns (on success - Connect flow)**: `{ success: true, connected: true, provider: string, username: string }`
- **Returns (on error)**: `{ error: string }`
