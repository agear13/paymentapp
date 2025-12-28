# File Restoration Guide

## Issue
Multiple files are being deleted/cleared during development. Files affected:
- `src/app/(dashboard)/dashboard/payment-links/page.tsx`
- `src/components/payment-links/payment-links-table.tsx`
- `src/components/dashboard/app-sidebar.tsx`
- `src/lib/supabase/middleware.ts`

## Quick Restore

If you see export errors, these files have been cleared. **Stop the dev server first** to prevent further file clearing:

```bash
# Stop the dev server (Ctrl+C in terminal)
# Then restore files using git if available:
git restore src/app/(dashboard)/dashboard/payment-links/page.tsx
git restore src/components/payment-links/payment-links-table.tsx
git restore src/components/dashboard/app-sidebar.tsx
git restore src/lib/supabase/middleware.ts
```

## Prevention Steps

1. **Stop the dev server** before making large changes
2. **Commit your work frequently** to git
3. **Check your editor settings** - disable auto-save during builds
4. **Clear .next folder** if issues persist:
   ```bash
   cd src
   Remove-Item -Path ".next" -Recurse -Force -ErrorAction SilentlyContinue
   npm run dev
   ```

## Files Status Check

Run this to check if files are empty:
```powershell
Get-ChildItem -Recurse -Include "*.tsx","*.ts" | Where-Object { $_.Length -eq 0 -or $_.Length -lt 10 } | Select-Object FullName, Length
```

## Current Working State

All files have been restored with the correct content:
- ✅ Payment links table displays all rows
- ✅ Sidebar with user auth
- ✅ Middleware with updateSession
- ✅ Page with polling fix (isLoading && length === 0)

## If Files Keep Getting Deleted

1. Check if Next.js Fast Refresh is causing issues
2. Try running in production mode: `npm run build && npm start`
3. Check disk space and permissions
4. Restart your computer to clear any locks
5. Use a different terminal/shell

## Test After Restoration

1. Refresh browser (Ctrl/Cmd + Shift + R for hard refresh)
2. Check for export errors in console
3. Verify payment links table shows rows
4. Test 3-dot menu actions
5. Test sign-out button

## Emergency: All Files Lost

If all files are lost and no git backup, I can restore them from the conversation history. Just ask!










