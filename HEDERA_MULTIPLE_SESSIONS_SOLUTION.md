# Hedera Multiple Sessions Issue - Solution

## Problem

You have **11 old WalletConnect sessions** from previous pairings. When you refresh the page and try to pay:

1. No new approval event fires (using existing session)
2. We try to find the active session among 11 options
3. The stored topic doesn't match any session
4. We fall back to "most recent by expiry" (probably wrong session)
5. HashPack doesn't receive the transaction → No approval prompt

## Why This Happens

Each time you:
- Scan a new QR code
- Test the connection
- Refresh and reconnect

A new WalletConnect session is created, but **old sessions are NOT automatically deleted**. Over time, this builds up to many sessions.

## The Solution

### Option 1: Clear Old Sessions in HashPack (Recommended)

1. Open HashPack wallet
2. Go to **Settings** → **Connected Sites** or **DApp Connections**
3. Find **Provvypay** connections
4. **Disconnect ALL old connections**
5. Go back to payment link
6. Connect fresh via QR code
7. Try payment → Should work!

### Option 2: Clear Browser Storage

1. In your browser, open DevTools (F12)
2. Go to **Application** tab → **Storage**
3. Click **Clear site data** for provvypay domain
4. Refresh page
5. Connect via QR code
6. Try payment

### Option 3: Use Incognito/Private Browser

- Open payment link in incognito/private window
- No old sessions stored
- Fresh connection every time
- Should work immediately

## Code Fix Applied

Updated `src/lib/hashconnectClient.ts` to:

### 1. Check Both Session and Pairing Topics

```typescript
// Check if stored topic matches either SESSION topic or PAIRING topic
let session = hederaSessions.find((s: any) => 
  s.topic === storedTopic || s.pairingTopic === storedTopic
);
```

**Why**: `latestPairingData.topic` could contain either type of topic depending on which event fired.

### 2. Better Logging

```typescript
console.log('[HashConnect] Available sessions:', hederaSessions.map((s: any) => ({
  session: s.topic.substring(0, 8) + '...',
  pairing: s.pairingTopic?.substring(0, 8) + '...',
})));
```

**Why**: Now you can see all available sessions and their topics to debug matching issues.

### 3. Clear Error Messages

```typescript
console.error('[HashConnect] ❌ CRITICAL: Stored topic does NOT match any sessions!');
console.error('[HashConnect] SOLUTION: Disconnect wallet and clear old sessions');
```

**Why**: Makes it obvious when the stored topic doesn't match any session.

## Expected Logs After Fix

### When Matching Session Found:
```
[HashConnect] Stored topic: b14e3415...
[HashConnect] Available sessions: [
  {session: '30431cda...', pairing: 'b14e3415...'},  ⬅️ MATCH!
  {session: '4655a2cb...', pairing: 'df12b683...'},
  ...
]
[HashConnect] ✅ Found matching session! (by pairing topic)
[HashConnect] Using session: 30431cda...
```

Then: ✅ Approval prompt appears!

### When No Matching Session (Old Sessions):
```
[HashConnect] Stored topic: b14e3415...
[HashConnect] Available sessions: [
  {session: '30431cda...', pairing: 'a1b2c3d4...'},  ⬅️ No match
  {session: '4655a2cb...', pairing: 'e5f6g7h8...'},  ⬅️ No match
  ...
]
[HashConnect] ❌ CRITICAL: Stored topic does NOT match any of 11 sessions!
[HashConnect] SOLUTION: Disconnect wallet and clear old sessions
```

Then: ❌ Probably won't work (using wrong session)

## Long-Term Solution

Consider adding a "Disconnect Wallet" button to your UI that:
1. Calls `hashConnect.disconnect()`
2. Clears stored sessions
3. Forces users to reconnect fresh

This prevents session buildup over time.

## For Development

When testing locally, regularly clear:
- Browser localStorage
- IndexedDB
- Service Worker cache

This prevents accumulating test sessions.

## Summary

The fix improves session matching by checking both session and pairing topics. However, with 11 old sessions, the best solution is to **clear old sessions in HashPack wallet** or **clear browser storage** and start fresh.

After clearing: The matching logic will work perfectly because there will only be 1 session (the current one).

