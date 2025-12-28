# Xero Integration Setup Guide

This guide walks you through setting up the Xero integration for Provvypay.

## Prerequisites

- Xero Developer account
- Access to your environment variables configuration
- Node.js runtime access (for encryption key generation)

## Step 1: Create Xero Application

1. **Go to Xero Developer Portal**
   - Navigate to https://developer.xero.com/
   - Sign in with your Xero credentials
   - Click "My Apps"

2. **Create New App**
   - Click "New app"
   - Choose "Web App" as the app type
   - Fill in the details:
     - **App name**: Provvypay (or your company name)
     - **Company or application URL**: Your website URL
     - **OAuth 2.0 redirect URI**: 
       - Development: `http://localhost:3000/api/xero/callback`
       - Production: `https://yourdomain.com/api/xero/callback`

3. **Save Configuration**
   - Click "Create app"
   - You'll see your Client ID
   - Click "Generate a secret" to get your Client Secret
   - **IMPORTANT**: Copy these immediately - you won't see the secret again!

## Step 2: Generate Encryption Key

The encryption key is used to secure OAuth tokens at rest in your database.

### Method 1: Using Node.js (Recommended)

```bash
# In your project root
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Method 2: Using the Project Utility

```typescript
// Create a temporary script: generate-key.ts
import { generateEncryptionKey } from './src/lib/xero';
console.log('Your encryption key:', generateEncryptionKey());

// Run it
npx tsx generate-key.ts
```

### Method 3: Using OpenSSL

```bash
openssl rand -base64 32
```

**IMPORTANT**: 
- Store this key securely
- Never commit it to version control
- Use different keys for development and production
- If you lose this key, all stored connections will be unusable

## Step 3: Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Xero OAuth Credentials
XERO_CLIENT_ID=your-client-id-from-step-1
XERO_CLIENT_SECRET=your-client-secret-from-step-1

# Xero Redirect URI (must match what you set in Xero Developer Portal)
XERO_REDIRECT_URI=http://localhost:3000/api/xero/callback

# Encryption Key (generated in step 2)
XERO_ENCRYPTION_KEY=your-base64-encoded-encryption-key

# Application URL (for OAuth redirects)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production Environment Variables

For production, update the URLs:

```bash
XERO_REDIRECT_URI=https://yourdomain.com/api/xero/callback
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Step 4: Verify Installation

1. **Check Dependencies**
   ```bash
   cd src
   npm list xero-node
   ```
   
   Should show: `xero-node@6.x.x`

2. **Verify Environment Variables**
   ```bash
   # Create test script: verify-env.ts
   const required = [
     'XERO_CLIENT_ID',
     'XERO_CLIENT_SECRET',
     'XERO_REDIRECT_URI',
     'XERO_ENCRYPTION_KEY',
     'NEXT_PUBLIC_APP_URL'
   ];

   const missing = required.filter(key => !process.env[key]);
   
   if (missing.length > 0) {
     console.error('Missing environment variables:', missing);
     process.exit(1);
   }
   
   console.log('✅ All Xero environment variables configured!');

   # Run it
   npx tsx verify-env.ts
   ```

## Step 5: Test the Integration

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Navigate to Integrations**
   - Go to http://localhost:3000/dashboard/settings/integrations
   - Find the Xero integration card

3. **Test Connection Flow**
   - Click "Connect to Xero"
   - You should be redirected to Xero
   - Authorize the connection
   - You should be redirected back with success message
   - Verify "Connected" status appears

4. **Check Database**
   ```bash
   npm run db:studio
   ```
   - Navigate to `xero_connections` table
   - Verify a record exists for your organization
   - Tokens should be encrypted (long base64 strings)

## Step 6: Configure Xero Scopes (Optional)

If you need additional permissions beyond the defaults:

1. **Current Scopes**
   - `offline_access` - Refresh tokens
   - `accounting.transactions` - Invoices and payments
   - `accounting.contacts.read` - Customer contacts
   - `accounting.settings.read` - Chart of accounts

2. **Adding More Scopes**
   
   Edit `src/lib/xero/client.ts`:
   ```typescript
   scopes: [
     'offline_access',
     'accounting.transactions',
     'accounting.contacts.read',
     'accounting.settings.read',
     'accounting.reports.read',  // Add this for reports
     'accounting.journals.read', // Add this for journals
   ],
   ```

3. **Update in Xero Developer Portal**
   - Go to your app settings
   - Update the scopes under "OAuth 2.0"
   - Users must reconnect for new scopes to take effect

## Troubleshooting

### Error: "Missing XERO_CLIENT_ID environment variable"

**Solution**: Ensure all environment variables are set and the `.env.local` file is in the correct location (`src/.env.local`).

### Error: "Invalid token response from Xero"

**Possible Causes**:
1. Incorrect Client ID or Secret
2. Redirect URI mismatch
3. Network connectivity issues

**Solution**: Verify credentials in Xero Developer Portal and ensure redirect URI matches exactly.

### Error: "No Xero tenants available"

**Possible Causes**:
1. User account not associated with any Xero organizations
2. Insufficient permissions

**Solution**: Ensure the Xero account has access to at least one organization.

### Connection Appears but API Calls Fail

**Possible Causes**:
1. Token expired and refresh failed
2. Encryption key changed
3. Token revoked in Xero

**Solution**:
1. Check token expiry in database
2. Try disconnecting and reconnecting
3. Verify encryption key hasn't changed

### Tokens Not Decrypting

**Possible Causes**:
1. Encryption key changed
2. Database corruption
3. Incomplete token data

**Solution**:
1. Verify `XERO_ENCRYPTION_KEY` matches the key used during encryption
2. If key lost, delete and recreate connection
3. Never change encryption key after storing tokens

## Security Best Practices

1. **Protect Client Secret**
   - Never commit to version control
   - Use environment variables only
   - Rotate periodically (requires reconnection)

2. **Protect Encryption Key**
   - Store in secure environment variable service
   - Use different keys per environment
   - Never reuse between projects
   - Rotate with caution (requires data migration)

3. **HTTPS in Production**
   - Always use HTTPS for OAuth redirects
   - Update redirect URIs in Xero Developer Portal
   - Verify SSL certificates are valid

4. **Token Lifecycle**
   - Tokens auto-refresh before expiry
   - Manual refresh triggers if needed
   - Revoke on disconnect
   - Monitor for failed refreshes

## Advanced Configuration

### Custom Token Refresh Buffer

Default: Tokens refresh when < 5 minutes until expiry

To change, edit `src/lib/xero/connection-service.ts`:

```typescript
// Change from 5 minutes to 10 minutes
const expiryBuffer = 10 * 60 * 1000; // 10 minutes
```

### Custom Redirect Handling

To customize post-connection redirect:

Edit `src/app/api/xero/callback/route.ts`:

```typescript
const redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/your-custom-page`;
```

### Logging

To enable detailed Xero SDK logging:

```typescript
// In src/lib/xero/client.ts
const xeroClient = new XeroClient({
  // ... existing config
  httpTimeout: 10000,
  state: 'your-custom-state', // Optional
});
```

## Production Deployment Checklist

- [ ] Created production Xero app in developer portal
- [ ] Set production redirect URI in Xero
- [ ] Generated unique production encryption key
- [ ] Set all environment variables in production
- [ ] Updated XERO_REDIRECT_URI to production URL
- [ ] Updated NEXT_PUBLIC_APP_URL to production URL
- [ ] Verified HTTPS is enabled
- [ ] Tested OAuth flow in production
- [ ] Verified token refresh works
- [ ] Set up monitoring for token refresh failures
- [ ] Documented recovery procedures

## Support

If you encounter issues not covered in this guide:

1. Check application logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test in Xero Developer Portal sandbox environment
4. Review Xero API documentation: https://developer.xero.com/documentation/
5. Check Xero API status: https://status.developer.xero.com/

## Next Steps

Once Xero authentication is working:

1. **Test multi-tenant scenarios** if users have multiple Xero organizations
2. **Implement account mapping** (Sprint 12)
3. **Set up invoice sync** (Sprint 12)
4. **Configure payment recording** (Sprint 12)
5. **Set up monitoring** for token refresh failures
6. **Document user-facing connection guide** for your customers

---

For development questions, see `SPRINT11_COMPLETE.md` for technical architecture details.






