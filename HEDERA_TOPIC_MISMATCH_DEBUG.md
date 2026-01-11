# Hedera Session Topic Mismatch - Debugging Session

## Issue Summary

The `hc.sendTransaction()` call is **NOT hanging** - it's immediately returning a **rejected promise** with the error:

```
Error: Signer could not find session on sign client
  at SignClientHelper.getSessionForAccount()
```

## Root Cause

When we call `hc.sendTransaction(sessionTopic, transactionRequest)`, the HashConnect SDK internally calls:
1. `getSigner()` to get the signer for the connected account
2. `SignClientHelper.getSessionForAccount()` to find the WalletConnect session
3. This method looks for a session with the topic we passed in
4. **It can't find the session** → throws error

## What This Means

The `sessionTopic` we're passing to `sendTransaction()` is **NOT** in the WalletConnect sign client's session list at the time we try to use it.

## Observed Behavior from User's Test

```javascript
[HederaWalletClient] Step 3: Calling hc.sendTransaction with topic: c3c46494a137fe17...
[HederaWalletClient] Step 3.2: sendTransaction() RETURNED!
[HederaWalletClient] Return value: Promise {<rejected>: Error: Signer could not find session on sign client
```

- sendTransaction returns **immediately** (not hanging)
- Returns a **rejected promise**
- Topic `c3c46494a137fe17...` doesn't exist in the sign client

## Changes Made - Enhanced Debugging

### 1. In `wallet-client.ts` (before calling sendTransaction)

Added code to:
- List ALL sessions in `_signClient.session.getAll()`
- Show each session's:
  - `topic`
  - `pairingTopic`
  - `expiry`
  - `acknowledged`
  - `namespaces`
- **Compare** the topic we're about to use with all available sessions
- Warn if NO matching session is found (which will cause the error)

```javascript
console.log('[HederaWalletClient] 🔍 ALL SESSIONS in _signClient:', {
  count: allSessions?.length || 0,
  sessions: allSessions?.map((s: any) => ({
    topic: s.topic,
    pairingTopic: s.pairingTopic,
    expiry: s.expiry,
    acknowledged: s.acknowledged,
  }))
});
console.log('[HederaWalletClient] 🎯 Looking for session with topic:', sessionTopic);
const matchingSession = allSessions?.find((s: any) => 
  s.topic === sessionTopic || s.pairingTopic === sessionTopic
);
console.log('[HederaWalletClient] 🔍 Matching session found?', !!matchingSession);
```

### 2. In `hashconnectClient.ts` (getSessionTopic function)

Added detailed topic matching debug logs:
```javascript
console.log(`[HashConnect] 🔍 TOPIC MATCHING DEBUG:`);
console.log(`[HashConnect]   Stored topic: ${storedTopic}`);
hederaSessions.forEach((s: any, idx: number) => {
  const matchesTopic = s.topic === storedTopic;
  const matchesPairing = s.pairingTopic === storedTopic;
  console.log(`[HashConnect]   Session ${idx + 1}:`, {
    topic: s.topic,
    pairingTopic: s.pairingTopic,
    matchesTopic,
    matchesPairing,
    willSelect: matchesTopic || matchesPairing,
  });
});
```

## What to Look For in Next Test

### After connecting wallet and trying to pay, we'll see:

1. **From `getSessionTopic()` - What topic is selected:**
   ```
   [HashConnect] 🔍 TOPIC MATCHING DEBUG:
   [HashConnect]   Stored topic: <stored_topic>
   [HashConnect]   Session 1: { topic: <topic1>, pairingTopic: <pairing1>, ... }
   [HashConnect]   Session 2: { topic: <topic2>, pairingTopic: <pairing2>, ... }
   [HashConnect] ✅ Found matching session! Using: <selected_topic>
   ```

2. **From `wallet-client.ts` - ALL available sessions when we try to send:**
   ```
   [HederaWalletClient] 🔍 ALL SESSIONS in _signClient: {
     count: 3,
     sessions: [
       { topic: <topic1>, pairingTopic: <pairing1>, ... },
       { topic: <topic2>, pairingTopic: <pairing2>, ... },
       { topic: <topic3>, pairingTopic: <pairing3>, ... }
     ]
   }
   [HederaWalletClient] 🎯 Looking for session with topic: <selected_topic>
   [HederaWalletClient] 🔍 Matching session found? true/false
   ```

3. **Key Questions to Answer:**
   - Is the topic we select in `getSessionTopic()` actually in the sign client's list?
   - Are we selecting the wrong topic?
   - Does the session disappear between when we select it and when we try to use it?
   - Are there old sessions from previous pairings interfering?

## Possible Scenarios

### Scenario A: Wrong Topic Selected
- `getSessionTopic()` selects topic X
- Sign client has topics A, B, C (but not X)
- **Solution:** Fix the session matching logic

### Scenario B: Session Disappears
- `getSessionTopic()` selects topic X
- Topic X exists at that time
- By the time we call `sendTransaction()`, topic X is gone
- **Solution:** Add session persistence or faster execution

### Scenario C: Old Sessions Interfering
- Multiple old sessions from previous wallet connections
- We're selecting an old/expired session
- HashPack is connected via a NEW session we're not detecting
- **Solution:** Clear old sessions, improve session selection logic

## Next Steps

1. **Wait for Render deployment** to complete
2. **Hard refresh** the payment page
3. **Connect wallet**
4. **Try payment**
5. **Copy ALL console logs** showing:
   - Topic matching debug (from HashConnect)
   - All sessions list (from HederaWalletClient)
   - Whether matching session was found

This will tell us **exactly** why the topic mismatch is happening.

