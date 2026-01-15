# Logo Upload Troubleshooting Guide

## Common Issues and Solutions

### Issue 1: "Organization not found" Error

**Symptoms:**
- Error message: "Organization not found. Please refresh the page and try again."
- Console shows: `Organization ID is missing`

**Causes:**
1. Organization data hasn't loaded yet
2. User not properly authenticated
3. Organization API endpoint returning empty array

**Solutions:**

#### Solution A: Wait for Data to Load
```typescript
// The form waits for organization data before enabling upload
// If you see the upload button, org data should be loaded
```

#### Solution B: Check Browser Console
```javascript
// Open DevTools Console and check for:
console.log('Organization ID:', organizationId);

// Should show a UUID like: "791bd0c8-029f-4988-836d-ced2bebc9e39"
// If undefined or null, organization fetch failed
```

#### Solution C: Verify Organization Exists
```bash
# Check database
psql $DATABASE_URL -c "SELECT id, name FROM organizations LIMIT 5;"

# Should return at least one organization
```

#### Solution D: Create Organization if Missing
If no organizations exist, you need to create one through the onboarding flow or manually:

```sql
-- Create organization manually (if needed for testing)
INSERT INTO organizations (id, clerk_org_id, name, created_at)
VALUES (
  gen_random_uuid(),
  'org_test123',  -- Replace with actual Clerk org ID
  'Test Organization',
  NOW()
);
```

---

### Issue 2: Next.js Image Optimization Error (400 Bad Request)

**Symptoms:**
- Error: `GET /_next/image?url=/uploads/logos/...png 400 (Bad Request)`
- Image shows broken icon
- Console error about image optimization

**Cause:**
Next.js Image component trying to optimize local uploaded files

**Solution:**
✅ **Already Fixed!** We've updated the code to use regular `<img>` tags instead of Next.js `<Image>` component for uploaded logos.

**Verification:**
```typescript
// In merchant-settings-form.tsx - should use <img> not <Image>
<img
  src={logoPreview}
  alt="Organization logo"
  className="max-h-24 w-auto object-contain"
/>

// In merchant-branding.tsx - should also use <img>
<img
  src={logoUrl}
  alt={`${merchantName} logo`}
  className="max-h-24 w-auto object-contain"
/>
```

---

### Issue 3: File Upload Returns 404

**Symptoms:**
- Upload button clicked but nothing happens
- Console shows: `POST /api/merchant-settings/upload-logo 404`

**Causes:**
1. API route not deployed
2. Route file in wrong location
3. Server needs restart

**Solutions:**

#### Solution A: Verify Route File Exists
```bash
# Check file exists
ls -la src/app/api/merchant-settings/upload-logo/route.ts

# Should show the route file
```

#### Solution B: Restart Dev Server
```bash
# Stop current server (Ctrl+C)
# Start fresh
npm run dev

# Or for production
npm run build
npm start
```

#### Solution C: Check Route Registration
```bash
# After server starts, check routes
curl http://localhost:3000/api/merchant-settings/upload-logo

# Should return 401 (Unauthorized) not 404
# 404 means route not found
# 401 means route exists but needs auth
```

---

### Issue 4: "Invalid file type" for Valid Images

**Symptoms:**
- Uploading PNG/JPG but getting "Invalid file type" error
- File is definitely a valid image

**Causes:**
1. File extension doesn't match MIME type
2. File corrupted
3. Browser sending wrong MIME type

**Solutions:**

#### Solution A: Check File MIME Type
```javascript
// In browser console after selecting file
const input = document.querySelector('input[type="file"]');
input.addEventListener('change', (e) => {
  const file = e.target.files[0];
  console.log('File type:', file.type);
  console.log('File name:', file.name);
});

// Should show: image/png, image/jpeg, or image/webp
```

#### Solution B: Re-save Image
Sometimes files get corrupted. Try:
1. Open image in image editor (Paint, Photoshop, etc.)
2. Save As → PNG or JPG
3. Try uploading again

#### Solution C: Use Different Image
Test with a known-good image:
```bash
# Download test image
curl -o test-logo.png https://via.placeholder.com/200x100.png

# Try uploading this test image
```

---

### Issue 5: Logo Uploads but Doesn't Display

**Symptoms:**
- Upload succeeds (green toast message)
- Preview doesn't show
- Logo not on invoice page

**Causes:**
1. File path incorrect
2. Public directory not accessible
3. Database not updated

**Solutions:**

#### Solution A: Verify File Saved
```bash
# Check uploads directory
ls -la public/uploads/logos/

# Should show your uploaded file
# Example: org_abc123-1705267200000.png
```

#### Solution B: Check File Permissions
```bash
# Ensure files are readable
chmod 644 public/uploads/logos/*

# Ensure directory is accessible
chmod 755 public/uploads/logos
```

#### Solution C: Verify Database Updated
```sql
-- Check merchant_settings table
SELECT 
  id, 
  display_name, 
  organization_logo_url 
FROM merchant_settings 
WHERE organization_id = 'YOUR_ORG_ID';

-- organization_logo_url should show: /uploads/logos/filename.png
```

#### Solution D: Clear Browser Cache
```javascript
// Hard refresh
// Windows/Linux: Ctrl + Shift + R
// Mac: Cmd + Shift + R

// Or open DevTools → Network tab → Disable cache
```

---

### Issue 6: File Uploads to Wrong Directory

**Symptoms:**
- Upload succeeds but file not found
- Path shows different location than expected

**Cause:**
Working directory different than expected

**Solution:**

#### Check and Create Directory
```bash
# From project root
mkdir -p public/uploads/logos

# Verify it exists
ls -la public/uploads/

# Should show logos/ directory
```

#### Verify Next.js Serving Static Files
```bash
# Test static file access
# Place a test file
echo "test" > public/test.txt

# Access in browser
http://localhost:3000/test.txt

# Should show "test"
# If 404, Next.js not serving public/ correctly
```

---

### Issue 7: Upload Works Locally but Fails in Production

**Symptoms:**
- Works fine in development
- Fails in deployed environment
- 500 or permission errors

**Causes:**
1. File system read-only (Vercel, Netlify)
2. Missing upload directory
3. Insufficient permissions

**Solutions:**

#### Solution A: Check Platform Limitations
```
Vercel/Netlify: File system is READ-ONLY
- Cannot write to local filesystem
- Must use external storage (S3, Cloudinary, etc.)
```

#### Solution B: Migrate to S3 (Production)
See `LOGO_UPLOAD_GUIDE.md` section "S3 Storage" for migration steps.

#### Solution C: Use Temporary Storage Services
For quick testing:
- Cloudinary (free tier)
- Uploadcare
- ImageKit

---

## Debugging Checklist

When logo upload fails, check these in order:

- [ ] **Browser Console** - Any JavaScript errors?
- [ ] **Network Tab** - What's the response from upload endpoint?
- [ ] **Server Logs** - Any errors in terminal?
- [ ] **File System** - Does `public/uploads/logos/` exist?
- [ ] **Database** - Is `organization_logo_url` updated?
- [ ] **Organization ID** - Is it loaded in the form?
- [ ] **Authentication** - Is user logged in?
- [ ] **File Type** - Is it PNG/JPG/WEBP?
- [ ] **File Size** - Is it under 2MB?
- [ ] **Permissions** - Can server write to upload directory?

---

## Quick Fixes

### Reset Everything
```bash
# 1. Stop server
# Ctrl+C

# 2. Clear uploads
rm -rf public/uploads/logos/*
mkdir -p public/uploads/logos
touch public/uploads/logos/.gitkeep

# 3. Restart server
npm run dev

# 4. Hard refresh browser
# Ctrl+Shift+R (Windows/Linux)
# Cmd+Shift+R (Mac)

# 5. Try upload again
```

### Test Upload Endpoint Directly
```bash
# Create test image
curl -o test.png https://via.placeholder.com/200x100.png

# Test upload (replace with your auth token and org ID)
curl -X POST http://localhost:3000/api/merchant-settings/upload-logo \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "logo=@test.png" \
  -F "organizationId=YOUR_ORG_ID"

# Should return:
# {"success":true,"url":"/uploads/logos/...","filename":"..."}
```

---

## Getting Help

If none of these solutions work:

1. **Collect Debug Info:**
   ```javascript
   // In browser console
   console.log('Organization ID:', organizationId);
   console.log('Settings ID:', settingsId);
   console.log('Logo Preview:', logoPreview);
   ```

2. **Check Server Logs:**
   ```bash
   # Look for errors in terminal where dev server is running
   # Should show upload attempts and any errors
   ```

3. **Test with Minimal Case:**
   - Use a simple 100x100 PNG
   - Try in incognito/private window
   - Test with different browser

4. **Verify Environment:**
   ```bash
   # Check Node version
   node --version  # Should be 18+
   
   # Check Next.js version
   npm list next
   
   # Check disk space
   df -h
   ```

---

**Last Updated:** January 14, 2026  
**Version:** 1.1

