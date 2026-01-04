# Install HashConnect Package

## Quick Instructions

The `hashconnect` package is needed for the Hedera wallet integration on the payment page.

### Step 1: Stop the Development Server

Press `Ctrl+C` in the terminal running `npm run dev`

### Step 2: Install the Package

Open a **new PowerShell terminal** and run:

```powershell
cd C:\Users\alish\Documents\paymentlink\src
npm install hashconnect
```

Wait for the installation to complete (may take 1-2 minutes).

### Step 3: Restart Development Server

```powershell
npm run dev
```

### Step 4: Test

1. Navigate to `/dashboard/payment-links` in your browser
2. Click the 3-dot menu on any payment link
3. Click "Download QR Code" - should work now
4. Click "Copy URL" and paste in a new browser tab
5. The payment page should load without errors

---

## Alternative: If NPM is Slow

If `npm install` is taking too long, you can use `yarn` instead:

```powershell
# Install yarn if you don't have it
npm install -g yarn

# Install hashconnect
yarn add hashconnect
```

---

## Troubleshooting

### If the install fails:
1. Clear npm cache: `npm cache clean --force`
2. Delete `node_modules` and `package-lock.json`
3. Run `npm install` to reinstall everything
4. Then try `npm install hashconnect` again

### If you don't need Hedera payments:
You can temporarily disable the Hedera integration by commenting out the import in:
- `src/lib/hedera/wallet-service.ts`

Or simply ignore the error - it only affects the payment page, not the dashboard.

---

## What This Package Does

`hashconnect` is the SDK for connecting to Hedera wallets (like HashPack) to enable cryptocurrency payments in HBAR on the Hedera network.

**Used for:**
- ✅ Wallet connection on payment pages
- ✅ Transaction signing
- ✅ Payment verification

**Not needed for:**
- Dashboard payment links table ✅
- Creating/editing payment links ✅
- Other admin features ✅










