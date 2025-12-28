# Xero Integration Quick Reference

Quick reference for developers working with the Xero integration.

## Service Usage

### Check Connection Status

```typescript
import { getConnectionStatus } from '@/lib/xero';

const status = await getConnectionStatus(organizationId);

if (status.connected) {
  console.log('Connected to tenant:', status.tenantId);
  console.log('Expires at:', status.expiresAt);
} else {
  console.log('Not connected');
}
```

### Get Valid Access Token

```typescript
import { getValidAccessToken } from '@/lib/xero';

// Automatically refreshes if expired
const token = await getValidAccessToken(organizationId);

if (token) {
  // Use token for Xero API calls
  console.log('Valid token:', token);
} else {
  // Connection invalid or doesn't exist
  console.log('No valid connection');
}
```

### Store New Connection

```typescript
import { storeXeroConnection } from '@/lib/xero';

await storeXeroConnection(
  organizationId,
  tenantId,
  accessToken,
  refreshToken,
  expiresAt
);
```

### Disconnect

```typescript
import { disconnectXero } from '@/lib/xero';

await disconnectXero(organizationId);
```

### Update Tenant

```typescript
import { updateSelectedTenant } from '@/lib/xero';

await updateSelectedTenant(organizationId, newTenantId);
```

## OAuth Flow

### Initiate Connection

```typescript
// User clicks "Connect to Xero"
// Redirect to:
window.location.href = `/api/xero/connect?organization_id=${orgId}`;

// Flow:
// 1. /api/xero/connect redirects to Xero
// 2. User authorizes
// 3. Xero redirects to /api/xero/callback
// 4. Callback exchanges code for tokens
// 5. Tokens stored encrypted
// 6. User redirected back to app
```

### Handle Callback Results

```typescript
// In your component
const searchParams = useSearchParams();

useEffect(() => {
  const success = searchParams.get('xero_success');
  const error = searchParams.get('xero_error');

  if (success === 'connected') {
    toast.success('Successfully connected to Xero!');
  }

  if (error) {
    toast.error(`Failed to connect: ${error}`);
  }
}, [searchParams]);
```

## API Endpoints

### GET /api/xero/connect

Initiates OAuth flow.

**Query Params:**
- `organization_id` (required)

**Response:** Redirect to Xero

### GET /api/xero/callback

Handles OAuth callback.

**Query Params:**
- `code` - Authorization code
- `state` - Encoded organization context
- `error` - Error code (if failed)

**Response:** Redirect to app with success/error

### POST /api/xero/disconnect

Disconnects Xero.

**Body:**
```json
{
  "organizationId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Xero connection disconnected successfully"
}
```

### GET /api/xero/status

Gets connection status.

**Query Params:**
- `organization_id` (required)

**Response:**
```json
{
  "connected": true,
  "tenantId": "tenant-uuid",
  "expiresAt": "2025-12-15T10:30:00Z",
  "connectedAt": "2025-12-14T09:00:00Z",
  "tenants": [...]
}
```

### POST /api/xero/tenant

Updates selected tenant.

**Body:**
```json
{
  "organizationId": "uuid",
  "tenantId": "tenant-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Xero tenant updated successfully"
}
```

## Token Encryption

### Encrypt Token

```typescript
import { encryptToken } from '@/lib/xero';

const encrypted = encryptToken('my-secret-token');
// Returns: base64 string with IV + encrypted data + auth tag
```

### Decrypt Token

```typescript
import { decryptToken } from '@/lib/xero';

const decrypted = decryptToken(encryptedString);
// Returns: original token string
```

### Generate New Key

```typescript
import { generateEncryptionKey } from '@/lib/xero';

const key = generateEncryptionKey();
console.log('Add to .env:', key);
```

## Database Queries

### Get Connection

```typescript
import { prisma } from '@/lib/prisma';

const connection = await prisma.xero_connections.findUnique({
  where: { organization_id: orgId },
});
```

### Update Token

```typescript
import { encryptToken } from '@/lib/xero';

await prisma.xero_connections.update({
  where: { organization_id: orgId },
  data: {
    access_token: encryptToken(newToken),
    expires_at: newExpiryDate,
  },
});
```

### Delete Connection

```typescript
await prisma.xero_connections.delete({
  where: { organization_id: orgId },
});
```

## UI Components

### Using XeroConnection Component

```tsx
import { XeroConnection } from '@/components/dashboard/settings/xero-connection';

<XeroConnection organizationId={organizationId} />
```

**Features:**
- Shows connection status
- Connect/disconnect buttons
- Tenant selector
- Auto-refresh status
- Error handling

## Common Patterns

### Check Before Xero API Call

```typescript
import { getValidAccessToken } from '@/lib/xero';

async function syncToXero(organizationId: string) {
  const token = await getValidAccessToken(organizationId);
  
  if (!token) {
    throw new Error('Xero not connected');
  }

  // Use token for API call
  const response = await fetch('https://api.xero.com/...', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Xero-Tenant-Id': tenantId,
    },
  });
}
```

### Handle Token Refresh Failure

```typescript
try {
  const token = await getValidAccessToken(organizationId);
} catch (error) {
  // Token refresh failed
  // Connection is invalid
  // User must reconnect
  console.error('Token refresh failed:', error);
  await disconnectXero(organizationId);
  throw new Error('Please reconnect to Xero');
}
```

### Multi-Tenant Handling

```typescript
import { getAvailableTenants } from '@/lib/xero';

const tenants = await getAvailableTenants(organizationId);

if (tenants && tenants.length > 1) {
  // Show tenant selector
  console.log('Multiple tenants:', tenants);
} else if (tenants && tenants.length === 1) {
  // Single tenant - already selected
  console.log('Single tenant:', tenants[0]);
}
```

## Environment Variables

Required variables:

```bash
XERO_CLIENT_ID=your-client-id
XERO_CLIENT_SECRET=your-client-secret
XERO_REDIRECT_URI=http://localhost:3000/api/xero/callback
XERO_ENCRYPTION_KEY=base64-encoded-32-byte-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Error Messages

| Error Code | Meaning | Action |
|------------|---------|--------|
| `missing_parameters` | Missing code or state | Retry connection |
| `invalid_state` | State parameter invalid | Retry connection |
| `no_tenants` | No Xero orgs available | Check Xero account |
| `connection_failed` | General connection error | Check logs, retry |

## Security Checklist

- ✅ Tokens encrypted at rest
- ✅ Tokens never logged
- ✅ Auto-refresh before expiry
- ✅ HTTPS in production
- ✅ State parameter for CSRF
- ✅ Environment variable secrets

## Testing

### Manual Test Flow

1. Navigate to Settings → Integrations
2. Click "Connect to Xero"
3. Authorize on Xero
4. Verify redirect back with success
5. Check "Connected" badge
6. Select different tenant (if multiple)
7. Click "Disconnect"
8. Verify "Not Connected" status

### API Test

```bash
# Status check
curl http://localhost:3000/api/xero/status?organization_id=YOUR_ORG_ID

# Disconnect
curl -X POST http://localhost:3000/api/xero/disconnect \
  -H 'Content-Type: application/json' \
  -d '{"organizationId":"YOUR_ORG_ID"}'
```

## Troubleshooting

### "Missing XERO_CLIENT_ID"
→ Check `.env.local` file exists and has correct variables

### "Invalid token response"
→ Verify Client ID and Secret in Xero Developer Portal

### "No tenants available"
→ Ensure Xero account has access to an organization

### Tokens not decrypting
→ Verify `XERO_ENCRYPTION_KEY` hasn't changed

### Connection lost after deployment
→ Check encryption key matches across environments

## Next Steps

After Sprint 11 is working:

1. **Sprint 12**: Implement Xero API calls
2. **Account Mapping**: Map ledger accounts to Xero
3. **Invoice Creation**: Create invoices in Xero
4. **Payment Recording**: Record payments in Xero
5. **Error Handling**: Retry logic and queue system

## Related Documentation

- `SPRINT11_COMPLETE.md` - Full technical documentation
- `XERO_SETUP_GUIDE.md` - Setup and configuration guide
- Xero API Docs: https://developer.xero.com/documentation/

---

For support, check logs and verify environment variables first.






