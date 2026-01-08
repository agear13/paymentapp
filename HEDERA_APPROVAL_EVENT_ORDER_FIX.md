# Hedera Approval Event Order Fix

## Issue Found

The approval event handler was being **overwritten** by the pairing event handler!

### Event Order:
1. **Approval Event** fires → Sets `latestPairingData.topic = "560e8b6a..."` (correct session topic)
2. **Pairing Event** fires → **REPLACES entire object** → `latestPairingData = {...pairingData, topic: fallbackTopic}`
3. Result: Correct topic from approval event is **LOST**

### Code That Caused the Bug:

```typescript
// Approval event (fires first)
latestPairingData.topic = approvalData.topic; // ✅ Sets correct topic

// Pairing event (fires second)  
latestPairingData = {
  ...pairingData,
  topic: topic || null, // ❌ Overwrites with fallback topic
};
```

## Fix Applied

### 1. Preserve Existing Topic in Pairing Event

```typescript
// Store existing topic before overwriting
const existingTopic = latestPairingData?.topic;

latestPairingData = {
  ...pairingData,
  topic: existingTopic || topic || null, // ✅ Prefer existing from approval
};
```

### 2. Prefer Stored Topic When Selecting Session

```typescript
// Check if we have a session topic from approval event
const storedTopic = latestPairingData?.topic;

// Try to find the stored topic in available sessions
let session = hederaSessions.find((s: any) => s.topic === storedTopic);

if (!session) {
  // Fallback to most recent by expiry
  session = sortedSessions[0];
}
```

### 3. Enhanced Logging

```typescript
console.log('[HashConnect] Session details:', {
  topic: sessionTopic,
  matchesStoredTopic: sessionTopic === storedTopic, // ✅ Verify we're using stored topic
  ...
});
```

## Why This Matters

**Approval Event Topic** = The session HashPack is listening on for transactions
**Pairing Event Topic** = Often undefined or a pairing topic (different from session topic)

If we use the wrong topic, HashPack never receives the transaction request → No approval prompt!

## Files Modified

- `src/lib/hashconnectClient.ts`
  - Fixed pairing event to preserve approval topic
  - Updated session selection to prefer stored topic
  - Added detailed logging

## Testing

After deploy, you should see in console:

```
[HashConnect] ========== APPROVAL EVENT FIRED ==========
[HashConnect] ✅ Storing session topic from approval event: 560e8b6a...
[HashConnect] latestPairingData after update: {topic: '560e8b6a...', ...}

[HashConnect] ========== PAIRING EVENT FIRED ==========
[HashConnect] latestPairingData updated: {
  hasExistingTopic: true,      ⬅️ Preserved!
  newTopic: 'df12b683...',
  finalTopic: '560e8b6a...'    ⬅️ Still using approval topic!
}

// Later when paying...
[HashConnect] Stored topic from pairing/approval: 560e8b6a...
[HashConnect] ✅ Found stored session topic in available sessions
[HashConnect] Session details: {
  topic: '560e8b6a...',
  matchesStoredTopic: true     ⬅️ Confirmed!
}
```

Then: ✅ Approval prompt appears in HashPack!

## Summary

The bug was an event handler race condition where the pairing event was overwriting the correct session topic set by the approval event. Now we preserve the approval event's topic and use it for transaction signing.

