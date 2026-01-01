# Prisma Logging Fix - Single Log Per Process

**Date:** December 31, 2025  
**Issue:** Prevent multiple "Prisma connected" logs per process  
**Solution:** Global flag to ensure logging only once per process

---

## ✅ Implementation

### File: `src/lib/prisma.ts`

Added `__prismaLogged` flag to ensure logging happens exactly once per process:

```typescript
// Global singleton with logging flag
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  __prismaLogged?: boolean;  // ← NEW: Track if we've logged
};

export const prisma =
  globalForPrisma.prisma ??
  (() => {
    // Only log once per process when actually creating a new instance
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.DATABASE_URL &&
      !globalForPrisma.__prismaLogged  // ← Check flag
    ) {
      const dbUrl = process.env.DATABASE_URL;
      const maskedUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
      console.log(`🔌 Prisma client instantiated (pid=${process.pid}), connected to: ${maskedUrl}`);
      globalForPrisma.__prismaLogged = true;  // ← Set flag
    }

    return new PrismaClient({
      log: ['error', 'warn'],
    });
  })();
```

---

## 🎯 Key Features

### 1. **Global Flag Pattern**
- `__prismaLogged` flag persists across hot reloads
- Only logs on first instantiation per process
- No logs on subsequent imports/hot reloads

### 2. **Process ID Included**
```
🔌 Prisma client instantiated (pid=12345), connected to: postgresql://...
```
- Shows which process created the client
- Helps identify multi-worker scenarios
- Useful for debugging Next.js serverless functions

### 3. **Production Safe**
- No logs in `NODE_ENV=production`
- Minimal overhead (single boolean check)
- No security concerns (password masked)

### 4. **Triple Guard**
```typescript
if (
  process.env.NODE_ENV !== 'production' &&  // ← Not in production
  process.env.DATABASE_URL &&                 // ← URL exists
  !globalForPrisma.__prismaLogged            // ← Haven't logged yet
)
```

---

## 🧪 Expected Behavior

### Development (`npm run dev`)

**Process starts:**
```
🔌 Prisma client instantiated (pid=12345), connected to: postgresql://...pooler...
```

**Hot reload (save file):**
```
(no log - flag prevents duplicate)
```

**Import in multiple files:**
```
(no log - singleton reused)
```

**Restart server (new process):**
```
🔌 Prisma client instantiated (pid=12456), connected to: postgresql://...pooler...
(new PID = new process = new log)
```

### Production (`npm run build && npm start`)

```
(no logs at all - production mode)
```

---

## ✅ Verification Results

### Search for Other Instantiations

```bash
grep -r "new PrismaClient" src/
```

**Result:** ✅ Only 1 match in `src/lib/prisma.ts` (line 31)

### Search for Other Prisma Logs

```bash
grep -ri "Prisma.*connect\|prisma.*instantiat" src/
```

**Result:** ✅ Only 1 match in `src/lib/prisma.ts` (line 27)

### TypeScript Compilation

```bash
npm run build
```

**Result:** ✅ No TypeScript errors

---

## 📊 Behavior Matrix

| Scenario | Log Output | Notes |
|----------|------------|-------|
| First `import { prisma }` | ✅ Logs with PID | New client created |
| Second `import { prisma }` | ❌ No log | Singleton reused |
| Hot reload (HMR) | ❌ No log | Flag prevents duplicate |
| New process | ✅ Logs with new PID | Flag reset in new process |
| Production mode | ❌ No log | Logs disabled |

---

## 🎓 Technical Details

### Why Global Flag?

**Without flag:**
```typescript
// BAD: Logs on every instantiation attempt
export const prisma = globalForPrisma.prisma ?? (() => {
  console.log('Connected'); // Logs even if client exists!
  return globalForPrisma.prisma ?? new PrismaClient();
})();
```

**With flag:**
```typescript
// GOOD: Logs only once per process
export const prisma = globalForPrisma.prisma ?? (() => {
  if (!globalForPrisma.__prismaLogged) {
    console.log('Connected');
    globalForPrisma.__prismaLogged = true;
  }
  return new PrismaClient();
})();
```

### Why Process ID?

Helps identify:
- Multiple processes in development
- Serverless function cold starts
- Worker thread behavior
- Connection pool issues

Example:
```
🔌 Prisma client instantiated (pid=12345), connected to: ...
🔌 Prisma client instantiated (pid=12346), connected to: ...
(Two different processes = two clients = expected)
```

### TypeScript Safety

```typescript
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  __prismaLogged?: boolean;  // ← Typed property
};

// TypeScript knows this exists
if (!globalForPrisma.__prismaLogged) { ... }
```

---

## 🔍 Debugging with PID

### Single Process (Expected)
```bash
npm run dev
🔌 Prisma client instantiated (pid=12345), connected to: ...
(only one log, same PID on restart)
```

### Multiple Processes (Investigate)
```bash
npm run dev
🔌 Prisma client instantiated (pid=12345), connected to: ...
🔌 Prisma client instantiated (pid=12346), connected to: ...
(two different PIDs = two processes - check Next.js config)
```

### Serverless Functions
```bash
# Each cold start = new process = new log
🔌 Prisma client instantiated (pid=1), connected to: ...
🔌 Prisma client instantiated (pid=1), connected to: ...
🔌 Prisma client instantiated (pid=1), connected to: ...
(different lambda instances, each with PID 1)
```

---

## ✅ Summary

**Changes:**
- ✅ Added `__prismaLogged` flag to `globalForPrisma`
- ✅ Check flag before logging
- ✅ Set flag after logging
- ✅ Include `process.pid` in log
- ✅ Verified no other `new PrismaClient()` calls
- ✅ Verified no other Prisma instantiation logs

**Result:**
- ✅ Exactly one log per process
- ✅ No logs on hot reload
- ✅ No logs in production
- ✅ PID helps identify multi-process scenarios

**Status:** Ready for `npm run dev` - will see log exactly once! 🎉

