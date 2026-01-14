# Logo Upload Feature Guide

## Overview

Merchants can now upload their organization logo as an image file directly through the Merchant Settings page. The logo will appear on customer-facing invoices and payment pages.

---

## Features

### ✅ File Upload
- **Supported formats**: PNG, JPG, JPEG, WEBP
- **Maximum file size**: 2MB
- **Automatic validation**: File type and size checks
- **Error handling**: Clear error messages for invalid files

### ✅ Image Preview
- Live preview of uploaded logo
- Shows actual size and appearance
- Remove button to delete logo
- Upload new logo replaces existing

### ✅ Storage
- Files stored in: `public/uploads/logos/`
- Naming convention: `{orgId}-{timestamp}.{ext}`
- Accessible via: `/uploads/logos/{filename}`
- URL stored in database: `merchant_settings.organization_logo_url`

---

## User Flow

### Uploading a Logo

1. Navigate to **Settings → Merchant**
2. Find the "Organization Logo (Optional)" section
3. Click **"Upload Logo"** button
4. Select image file from computer
5. File uploads automatically
6. Preview appears below with remove button
7. Click **"Save Settings"** to persist

### Removing a Logo

1. Navigate to **Settings → Merchant**
2. Find current logo preview
3. Click the **X** button (top-right of preview)
4. Logo is removed
5. Click **"Save Settings"** to persist

---

## Technical Details

### API Endpoint

**POST** `/api/merchant-settings/upload-logo`

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Body:
  - `logo`: File (image)
  - `organizationId`: String (UUID)

**Response:**
```json
{
  "success": true,
  "url": "/uploads/logos/{filename}",
  "filename": "org123-1234567890.png"
}
```

**Errors:**
- `400`: No file provided / Invalid file type / File too large
- `401`: Unauthorized
- `500`: Server error

### File Validation

```typescript
// Allowed MIME types
const ALLOWED_TYPES = [
  'image/png',
  'image/jpeg', 
  'image/jpg',
  'image/webp'
];

// Maximum file size
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
```

### File Naming

Files are saved with a unique name to prevent conflicts:

```
{sanitizedOrgId}-{timestamp}{extension}

Example: org_abc123-1705267200000.png
```

### Directory Structure

```
public/
└── uploads/
    └── logos/
        ├── .gitkeep              (tracked in git)
        ├── org_abc-123.png       (ignored by git)
        └── org_xyz-456.webp      (ignored by git)
```

---

## Display Locations

The uploaded logo appears in these locations:

### 1. Customer Invoice Page
- **Location**: `/pay/[shortCode]`
- **Component**: `MerchantBranding`
- **Size**: Max height 96px, auto width
- **Fallback**: Building icon if no logo

### 2. Payment Page
- **Location**: Public payment interface
- **Component**: `PaymentPageContent`
- **Display**: Top of payment card

### 3. Email Templates (Future)
- Can be included in invoice emails
- Passed as prop to email template
- Responsive email-safe sizing

---

## Security Considerations

### ✅ Implemented
- Authentication required (getCurrentUser check)
- File type validation (MIME type check)
- File size validation (2MB limit)
- Sanitized filenames (removes special chars)
- Server-side validation

### 🔒 Recommendations
- Consider virus scanning for production
- Implement rate limiting on upload endpoint
- Add organization ownership check
- Consider CDN for production (S3 + CloudFront)

---

## Production Deployment

### Local Storage (Current)
Files are stored in `public/uploads/logos/` on the server filesystem.

**Pros:**
- Simple implementation
- No external dependencies
- Fast local access

**Cons:**
- Not suitable for multi-server deployments
- No automatic backups
- Limited scalability

### S3 Storage (Recommended for Production)

To migrate to S3:

1. **Install AWS SDK**
```bash
npm install @aws-sdk/client-s3
```

2. **Update upload endpoint**
```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: 'us-east-1' });

// Upload to S3
const command = new PutObjectCommand({
  Bucket: 'your-bucket-name',
  Key: `logos/${filename}`,
  Body: buffer,
  ContentType: file.type,
});

await s3Client.send(command);

// Return CDN URL
const publicUrl = `https://cdn.yourdomain.com/logos/${filename}`;
```

3. **Configure CloudFront CDN**
- Faster delivery
- Edge caching
- HTTPS support
- Cost effective

---

## Testing

### Manual Testing Checklist

- [ ] Upload PNG file < 2MB → Success
- [ ] Upload JPG file < 2MB → Success
- [ ] Upload WEBP file < 2MB → Success
- [ ] Upload file > 2MB → Error "File too large"
- [ ] Upload PDF file → Error "Invalid file type"
- [ ] Upload without file → Error "No file provided"
- [ ] Upload without authentication → 401 error
- [ ] Preview displays correctly
- [ ] Remove logo works
- [ ] Logo appears on invoice page
- [ ] Logo fallback works (no logo set)
- [ ] Logo persists after page refresh

### Automated Testing

```typescript
// Example test
describe('Logo Upload', () => {
  it('should upload valid image file', async () => {
    const formData = new FormData();
    formData.append('logo', file);
    formData.append('organizationId', orgId);

    const response = await fetch('/api/merchant-settings/upload-logo', {
      method: 'POST',
      body: formData,
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.url).toMatch(/^\/uploads\/logos\//);
  });

  it('should reject oversized file', async () => {
    const largeFile = new File([/* 3MB data */], 'large.png');
    // ... test rejection
  });
});
```

---

## Troubleshooting

### Logo not displaying

**Check:**
1. File uploaded successfully (check response)
2. URL saved in database (`organization_logo_url` field)
3. File exists in `public/uploads/logos/`
4. Public directory is accessible
5. Next.js serving static files correctly

**Solution:**
```bash
# Verify file exists
ls -la public/uploads/logos/

# Check database
SELECT organization_logo_url FROM merchant_settings WHERE id = 'xxx';

# Restart Next.js dev server
npm run dev
```

### Upload fails silently

**Check:**
1. Network tab in browser DevTools
2. Server logs for errors
3. File permissions on upload directory
4. Disk space available

**Solution:**
```bash
# Create directory if missing
mkdir -p public/uploads/logos

# Set correct permissions
chmod 755 public/uploads/logos

# Check disk space
df -h
```

### "File too large" for small file

**Check:**
1. Next.js body size limit
2. Nginx/proxy upload limit
3. Actual file size in bytes

**Solution:**
```javascript
// next.config.js
module.exports = {
  api: {
    bodyParser: {
      sizeLimit: '4mb', // Adjust as needed
    },
  },
};
```

---

## Future Enhancements

### Potential Improvements

1. **Image Optimization**
   - Automatic resize to max dimensions
   - Convert to WebP for better compression
   - Generate multiple sizes (thumbnail, full)

2. **Drag & Drop**
   - Drag file onto upload area
   - Visual feedback during drag
   - Drop to upload

3. **Image Editing**
   - Crop tool
   - Rotate tool
   - Brightness/contrast adjustments

4. **Multiple Logos**
   - Dark mode variant
   - Favicon
   - Email header logo

5. **CDN Integration**
   - Automatic CDN upload
   - Optimized delivery
   - Cache management

---

## Support

For questions or issues with logo upload:

1. Check this guide first
2. Review server logs
3. Check browser console
4. Verify file meets requirements
5. Test with different image file

---

**Last Updated:** January 14, 2026  
**Version:** 1.0  
**Status:** ✅ Production Ready

