# Integrations Module

## Entities

### Integration
| Field | Type | Description |
| :--- | :--- | :--- |
| id | uuid | Primary key, auto-generated |
| userId | uuid | Foreign key to User |
| provider | enum | "twitch", "kick", "youtube" |
| displayName | text | Optional custom name set by user |
| providerUsername | text | Name on the external service |
| providerUserId | text | ID on the external service |
| providerAvatarUrl | text | Avatar icon link |
| accessToken | text | Encrypted provider access token |
| refreshToken | text | Encrypted provider refresh token |
| tokenExpiresAt | timestamp | Provider token expiration |
| allowOauthLogin | boolean | Allow logging into the app using this account |
| createdAt | timestamp | Auto-generated |
| updatedAt | timestamp | Auto-generated |

## Endpoints

### List Integrations
`GET /integrations/`
- **Auth required**
- **Returns**: `{ integrations: Integration[] }`

### Get Integration
`GET /integrations/:provider`
- **Auth required**
- **Params**: `provider` ("twitch", "kick", "youtube")
- **Returns**: `{ integration: Integration }`

### Update Integration Settings
`PATCH /integrations/:provider`
- **Auth required**
- **Params**: `provider`
- **Body**: `{ displayName?: string | null, allowOauthLogin?: boolean }`
- **Returns**: `{ success: true, integration: Integration }`

### Refresh Integration Tokens
`POST /integrations/:provider/refresh`
- **Auth required**
- **Params**: `provider`
- **Returns**: `{ success: true, message: "Integration refreshed", accessToken: string }`

### Disconnect Integration
`DELETE /integrations/:provider`
- **Auth required**
- **Params**: `provider`
- **Returns**: `{ success: true, message: "Provider disconnected" }`

### Initiate Connect
`POST /integrations/connect/:provider`
- **Auth required**
- **Params**: `provider`
- **Returns**: `{ url: string, state: string }`
  - *The client should redirect the user to this URL.*
