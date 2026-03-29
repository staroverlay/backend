# Profiles Module

## Entities

### Profile
| Field | Type | Description |
| :--- | :--- | :--- |
| id | uuid | Primary key, auto-generated |
| userId | uuid | Unique, foreign key to User |
| displayName | text | Required display name |
| createdAt | timestamp | Auto-generated |
| updatedAt | timestamp | Auto-generated |

## Endpoints

### Get Profile
`GET /profile/`
- **Auth required**
- **Returns**: `{ profile: Profile }`

### Upsert Profile
`PUT /profile/`
- **Auth required**
- **Body**: `{ displayName: string }`
- **Returns**: `{ success: true, profile: Profile }`

### Delete Profile
`DELETE /profile/`
- **Auth required**
- **Returns**: `{ success: true, message: "Profile deleted" }`
