# Xero Configuration Fix

## Problem
When attempting to connect to Xero, the application returned:
```json
{"error":"Failed to initiate Xero connection"}
```

The root cause was that the Xero integration code had hard checks at the module level that threw errors when the required environment variables were not set:
- `XERO_CLIENT_ID`
- `XERO_CLIENT_SECRET`
- `XERO_REDIRECT_URI`

This caused the entire `/api/xero/connect` endpoint to fail during module import, before any request handling could occur.

## Solution

### 1. Made Xero Configuration Checks Graceful

**File: `src/lib/xero/client.ts`**

**Before:**
```typescript
if (!process.env.XERO_CLIENT_ID) {
  throw new Error('Missing XERO_CLIENT_ID environment variable');
}

if (!process.env.XERO_CLIENT_SECRET) {
  throw new Error('Missing XERO_CLIENT_SECRET environment variable');
}

if (!process.env.XERO_REDIRECT_URI) {
  throw new Error('Missing XERO_REDIRECT_URI environment variable');
}
```

**After:**
```typescript
/**
 * Check if Xero is properly configured
 */
export function isXeroConfigured(): boolean {
  return !!(
    process.env.XERO_CLIENT_ID &&
    process.env.XERO_CLIENT_SECRET &&
    process.env.XERO_REDIRECT_URI
  );
}

/**
 * Get or create Xero client instance
 * @throws Error if Xero credentials are not configured
 */
export function getXeroClient(): XeroClient {
  if (!isXeroConfigured()) {
    throw new Error(
      'Xero integration is not configured. Please set XERO_CLIENT_ID, XERO_CLIENT_SECRET, and XERO_REDIRECT_URI environment variables.'
    );
  }
  // ... rest of function
}
```

### 2. Added Configuration Check to API Endpoint

**File: `src/app/api/xero/connect/route.ts`**

```typescript
export async function GET(request: NextRequest) {
  try {
    // Check if Xero is configured
    if (!isXeroConfigured()) {
      logger.error('Xero integration not configured');
      return NextResponse.json(
        { 
          error: 'Xero integration is not configured. Please contact support.',
          details: 'Missing required environment variables: XERO_CLIENT_ID, XERO_CLIENT_SECRET, XERO_REDIRECT_URI'
        },
        { status: 503 }
      );
    }
    // ... rest of endpoint
  }
}
```

### 3. Additional Fixes

- **Made `generateAuthUrl()` async**: Updated to match the xero-node API which returns a Promise
- **Fixed `revokeConnection()`**: Added optional `tenantId` parameter to satisfy the xero-node `disconnect()` method signature
- **Fixed logger calls**: Corrected logger signature to `logger.info(context, message)` format
- **Exported `isXeroConfigured`**: Added to `src/lib/xero/index.ts` for use in API routes

## Configuration Required

To enable Xero integration, add the following environment variables to your Render deployment:

```bash
XERO_CLIENT_ID=your_xero_client_id
XERO_CLIENT_SECRET=your_xero_client_secret
XERO_REDIRECT_URI=https://yourdomain.com/api/xero/callback
```

### How to Get Xero Credentials

1. Go to [Xero Developer Portal](https://developer.xero.com/)
2. Create a new app or select an existing one
3. Copy the **Client ID** and **Client Secret**
4. Set the **Redirect URI** to match your deployment URL + `/api/xero/callback`

## Testing

### Without Configuration (Default Behavior)
When Xero environment variables are not set:
- The application will not crash during build or startup
- Users will see a clear error message: "Xero integration is not configured. Please contact support."
- The error response includes details about missing variables (useful for admins)

### With Configuration
Once environment variables are set:
- The OAuth flow should initiate successfully
- Users will be redirected to Xero for authorization
- After approval, they'll be redirected back with a valid connection

## Related Files
- `src/lib/xero/client.ts` - Core Xero client with configuration checks
- `src/lib/xero/index.ts` - Module exports
- `src/app/api/xero/connect/route.ts` - OAuth initiation endpoint
- `src/lib/config/env.ts` - Environment variable validation (Xero vars are optional)

## Impact
- ✅ Application no longer crashes when Xero is not configured
- ✅ Clear error messages for users and administrators
- ✅ Graceful degradation - other features work normally
- ✅ Easy to enable Xero later by just adding environment variables

## Next Steps
1. **For Development**: Add Xero credentials to `.env.local`
2. **For Production**: Add Xero credentials to Render environment variables
3. **For Testing**: Use Xero's sandbox/demo organization

---

**Date**: 2026-01-11  
**Status**: ✅ Fixed and Deployed

