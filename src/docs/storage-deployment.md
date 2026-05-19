# Operational Asset Storage (Cloudflare R2)

Production uploads (merchant logos, invoice attachments, payment instructions) are stored in **Cloudflare R2** via `src/lib/storage/storage-service.ts`. The Render filesystem is **not** used for production asset persistence.

## Required R2 setup

1. Create an R2 bucket in Cloudflare (e.g. `provvypay-assets`).
2. Enable public access for the bucket **or** attach a custom domain (recommended for production).
3. Create an R2 API token with **Object Read & Write** on that bucket.
4. Note your Cloudflare **Account ID**.

### Object key layout

| Category | Path pattern | Visibility |
|----------|--------------|------------|
| Merchant logos | `merchant-logos/{organizationId}/{uuid}.{ext}` | Public |
| Invoice attachments | `invoice-attachments/{organizationId}/{invoiceId}/{uuid}.{ext}` | Private (API proxy) |
| Payment instructions | `payment-instructions/{organizationId}/{uuid}.{ext}` | Private |

## Render environment variables

Add to the `provvypay-production` environment group:

```bash
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=provvypay-assets
R2_PUBLIC_URL=https://assets.yourdomain.com
```

Optional CDN override (future):

```bash
ASSET_CDN_URL=https://cdn.yourdomain.com
```

Staging on Render may continue using `ALLOW_INFRASTRUCTURE_DOMAINS=true` for customer-facing URLs; asset URLs always resolve from `R2_PUBLIC_URL` / `ASSET_CDN_URL`.

## Local development

When R2 is not configured, uploads fall back to `public/uploads/` on disk **only in non-production** environments.

To disable local fallback:

```bash
STORAGE_ALLOW_LOCAL_FALLBACK=false
```

## Migration from filesystem logos

Existing DB values like `/uploads/logos/org-123.png` continue to resolve via `resolveAssetUrl()` (legacy relative path support). Operators should **re-upload logos** after R2 is configured so new uploads persist across deploys.

Legacy invoice attachments stored in Supabase (`payment-link-attachments` bucket, keys `payment-links/...`) remain readable/deletable via the legacy adapter until re-uploaded to R2.

## Health check

Deep health check (`HEALTHCHECK_DEEP=1`) reports storage configuration:

```bash
GET /api/health?  # with HEALTHCHECK_DEEP=1 on server
```

## CDN path (later)

1. Point `ASSET_CDN_URL` at Cloudflare CDN/custom domain in front of R2.
2. No application code changes required — all URLs resolve through `resolveAssetUrl()`.

## Security notes

- SVG uploads are blocked.
- MIME type and extension are cross-validated per asset category.
- Organization ownership is enforced on storage keys.
- Private attachments are never exposed via direct public URLs; they stream through `/api/public/pay/[shortCode]/attachment`.
