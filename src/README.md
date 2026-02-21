This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Environment Variables

### Wise Payments Configuration

To enable Wise bank transfer payments:

```bash
# Enable Wise payments globally
ENABLE_WISE_PAYMENTS=true

# Wise API token (from Wise Business account)
WISE_API_TOKEN=your-wise-api-token

# Optional: Global Wise profile ID (per-merchant wise_profile_id is preferred)
WISE_PROFILE_ID=your-profile-id

# Default Wise profile ID for NEW merchant settings (auto-enables Wise for new orgs)
# Falls back to WISE_PROFILE_ID if not set
DEFAULT_WISE_PROFILE_ID=84420198
```

**Auto-enable Wise for new orgs (beta):**
- New merchant settings are created with `wise_enabled = true` by default
- `wise_currency` defaults to the merchant's `default_currency` (or "AUD")
- `wise_profile_id` is set from `DEFAULT_WISE_PROFILE_ID` (or `WISE_PROFILE_ID`)
- If no profile ID is configured, Wise won't appear on public pay pages (DEV warning logged)
- Existing orgs are NOT affected - only new merchant settings get these defaults

**Per-merchant configuration (manual override):**
- Each merchant can override Wise settings in their merchant settings
- Set `wise_enabled = false` to disable Wise for a specific merchant
- Set a custom `wise_profile_id` to use a different Wise account
- Set `wise_currency` for the default payout currency

When properly configured, customers will see real bank details (IBAN, account number, BIC/SWIFT) and a unique payment reference when selecting Wise as a payment method.
