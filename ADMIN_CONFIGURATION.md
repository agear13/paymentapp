# Admin Configuration Guide

## Overview

This application uses an email-based allowlist for admin authentication. Admin users have access to sensitive operations like approving conversions, moderating reviews, and managing programs.

## Setting Up Admin Access

### 1. Configure Admin Emails

Add the `ADMIN_EMAILS` environment variable to your deployment:

```bash
ADMIN_EMAILS=admin@yourcompany.com,manager@yourcompany.com,support@yourcompany.com
```

**Format:**
- Comma-separated list of email addresses
- Email addresses are case-insensitive
- Whitespace around emails is automatically trimmed

**Example:**
```bash
# Single admin
ADMIN_EMAILS=john@example.com

# Multiple admins
ADMIN_EMAILS=john@example.com,jane@example.com,admin@company.com
```

### 2. Local Development

Create or update your `.env.local` file:

```bash
# .env.local
ADMIN_EMAILS=your-dev-email@gmail.com
```

### 3. Production Deployment

#### Render
1. Go to your service dashboard
2. Navigate to "Environment" tab
3. Add environment variable:
   - **Key**: `ADMIN_EMAILS`
   - **Value**: `admin@yourcompany.com,manager@yourcompany.com`
4. Save and redeploy

#### Vercel
```bash
vercel env add ADMIN_EMAILS
# Enter the comma-separated email list when prompted
```

#### Other Platforms
Set the environment variable according to your platform's documentation.

## Protected Operations

The following operations require admin authentication:

### Referral System
- **POST** `/api/referrals/conversions/[id]/approve` - Approve conversion
- **POST** `/api/referrals/conversions/[id]/reject` - Reject conversion

### HuntPay System (if enabled)
- **POST** `/api/huntpay/admin/conversions/[id]/approve` - Approve HuntPay conversion
- **POST** `/api/huntpay/admin/conversions/[id]/reject` - Reject HuntPay conversion

### Future Admin Operations
- Program creation/editing
- Participant management
- Review moderation
- Payout processing

## How It Works

### Authentication Flow

1. **User Login**: User authenticates via Supabase Auth
2. **Email Check**: System retrieves user's email from auth session
3. **Allowlist Verification**: Compares user email against `ADMIN_EMAILS` list
4. **Authorization**: Grants or denies access based on match

### Code Implementation

The admin check is implemented in `src/lib/auth/admin.ts`:

```typescript
import { checkAdminAuth } from '@/lib/auth/admin';

// In your API route:
const { isAdmin, user, error } = await checkAdminAuth();

if (!isAdmin) {
  return NextResponse.json(
    { error: error || 'Forbidden' },
    { status: 403 }
  );
}

// Proceed with admin operation
```

### Response Codes

- **401 Unauthorized**: User is not logged in
- **403 Forbidden**: User is logged in but not in admin allowlist
- **200 OK**: User is authenticated and authorized

## Security Considerations

### Best Practices

1. **Use Work Emails**: Prefer company email addresses over personal emails
2. **Rotate Access**: Review and update the allowlist regularly
3. **Least Privilege**: Only add users who need admin access
4. **Monitor Usage**: Log admin operations for audit trail
5. **Separate Environments**: Use different admin lists for dev/staging/prod

### Example Configuration

```bash
# Development
ADMIN_EMAILS=dev@localhost.com,test@localhost.com

# Staging
ADMIN_EMAILS=qa@company.com,staging-admin@company.com

# Production
ADMIN_EMAILS=admin@company.com,ceo@company.com,operations@company.com
```

## Troubleshooting

### "Admin access not configured" Error

**Cause**: `ADMIN_EMAILS` environment variable is not set or is empty.

**Fix**: 
1. Add `ADMIN_EMAILS` to your environment variables
2. Restart your application/deployment

### "Forbidden: Admin access required" Error

**Cause**: User's email is not in the admin allowlist.

**Fix**:
1. Verify the user's email address (case-insensitive)
2. Add the email to `ADMIN_EMAILS`
3. Restart your application (environment variables are loaded at startup)

### Email Not Matching

**Causes**:
- Typo in `ADMIN_EMAILS`
- User logged in with different email than expected
- Extra whitespace in email addresses

**Debug**:
```typescript
// Check current user email
const { data: { user } } = await supabase.auth.getUser();
console.log('User email:', user?.email);

// Check configured admins
console.log('Admin emails:', process.env.ADMIN_EMAILS);
```

## Testing Admin Access

### Manual Test

1. **Login** as a user
2. **Attempt** an admin operation (e.g., approve conversion)
3. **Verify** you get:
   - 401 if not logged in
   - 403 if logged in but not admin
   - 200 if logged in as admin

### Automated Test Script

```typescript
// test-admin-auth.ts
import { checkAdminAuth } from '@/lib/auth/admin';

async function testAdminAuth() {
  const { isAdmin, user, error } = await checkAdminAuth();
  
  console.log('Admin check result:');
  console.log('- Is Admin:', isAdmin);
  console.log('- User:', user?.email || 'Not logged in');
  console.log('- Error:', error || 'None');
}
```

## Adding New Admin-Protected Routes

When creating new admin-only endpoints:

```typescript
import { checkAdminAuth } from '@/lib/auth/admin';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  // 1. Check admin auth first
  const { isAdmin, user, error } = await checkAdminAuth();
  
  if (!isAdmin) {
    return NextResponse.json(
      { error: error || 'Forbidden' },
      { status: error === 'Authentication required' ? 401 : 403 }
    );
  }

  // 2. Proceed with admin operation
  // Your admin logic here...

  return NextResponse.json({ success: true });
}
```

## Role-Based Access Control (Future Enhancement)

Currently, the system uses a simple allowlist. For more granular control, consider implementing:

- **User Roles**: Admin, Moderator, Viewer
- **Permission Levels**: Full access, read-only, specific operations
- **Database Storage**: Store roles in `user_profiles` table
- **Audit Logging**: Track all admin actions

### Example Future Schema

```sql
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  role TEXT NOT NULL CHECK (role IN ('admin', 'moderator', 'user')),
  permissions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Support

For issues with admin access:
1. Verify `ADMIN_EMAILS` is set correctly
2. Check application logs for auth errors
3. Ensure user is logged in with the correct email
4. Contact system administrator to add your email to the allowlist

## Related Documentation

- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Referral System](CONSULTANT_REFERRAL_SYSTEM.md)
- [HuntPay System](HUNTPAY_README.md)
- [Deployment Guide](DEPLOYMENT_FIX.md)
