# B5 Deployment Checklist

**Date:** 2026-06-04  
**Applies to:** C1, C3, C4, C5 production hardening release.

---

## Required environment variables (production)

| Variable | Requirement |
|----------|-------------|
| `NODE_ENV` | `production` |
| `STRIPE_WEBHOOK_SECRET` | Valid `whsec_*`; **not** empty or `disabled` |
| `CRON_SECRET` | ≥ 16 characters; same value on web + all Render cron services |
| `STRIPE_SECRET_KEY` | `sk_live_*` unless staging override below |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_live_*` unless staging override below |
| `ADMIN_EMAIL_ALLOWLIST` | Comma-separated ops emails (authoritative) |

### Deprecated (still merged if set)

| Variable | Notes |
|----------|-------|
| `ADMIN_EMAILS` | Deprecated — unioned with `ADMIN_EMAIL_ALLOWLIST`; migrate to allowlist only |

### Staging-only override

| Variable | When |
|----------|------|
| `ALLOW_STRIPE_TEST_KEYS=true` | Render staging using Stripe test mode **only** — never on live GA |

---

## Rollout order

1. **Pre-deploy (no code yet on prod)**  
   - Export current Render env backup.  
   - Generate `CRON_SECRET` if missing: `openssl rand -base64 32`  
   - Set live Stripe webhook secret from Dashboard (not `disabled`).  
   - Set `ADMIN_EMAIL_ALLOWLIST` to all operators who use admin/cron-adjacent UI.

2. **Update env group `provvypay-production`**  
   - Apply all required variables above.  
   - Remove `STRIPE_WEBHOOK_SECRET=disabled` if present.  
   - Copy `ADMIN_EMAILS` into `ADMIN_EMAIL_ALLOWLIST` if only legacy var was set.

3. **Validate locally against exported env**  
   ```bash
   # Load production env into shell, then:
   node scripts/validate-render-env.js
   ```
   Expect: all required + B3 `CRON_SECRET` + B5 Stripe live keys pass.

4. **Deploy application**  
   - Push commit with B5 hardening.  
   - Render blueprint: web + 8 cron services.  
   - **First boot will fail** if env still invalid (intentional fail-fast).

5. **Post-deploy verification**  
   - Web service status: **Live** (not crash-loop).  
   - Cron services: last run **Succeeded**.  
   - Stripe test payment in **live** mode (small amount) or Dashboard webhook test event.  
   - `curl` job with bad secret → **401**; with good secret → **2xx**.

---

## Validation commands

```bash
# Full Render env check (run with production env loaded)
node scripts/validate-render-env.js

# Manual cron smoke (from machine with prod env)
cd src && npm run cron:invoke -- expired-links

# Unauthorized cron (expect 401)
curl -s -o /dev/null -w "%{http_code}" -X POST \
  "$NEXT_PUBLIC_APP_URL/api/jobs/expired-links" \
  -H "X-Cron-Secret: wrong-secret"

# Stripe webhook misconfig should prevent process start — check Render logs for:
# "Production environment hardening failed"
```

### Unit tests (CI / local)

```bash
cd src && npx jest __tests__/config/ --no-cache
```

---

## Rollback procedure

1. **Immediate:** Redeploy previous **known-good** release image in Render.  
2. **If crash-loop persists:** Old release still enforces new guards if env invalid — must fix env **or** temporarily:
   - Set valid `whsec_*`, `CRON_SECRET`, live Stripe keys, **or**
   - Not recommended: downgrade only if emergency (previous code allowed `disabled` webhook).  
3. **Env rollback:** Restore backed-up env group; redeploy.  
4. **Verify:** Web health `GET /api/health` → 200; one cron job success; Stripe webhook deliveries succeeding in Dashboard.

---

## Success criteria

- [ ] Production web service starts without `Production environment hardening failed` in logs  
- [ ] `CRON_SECRET` present on web + cron services  
- [ ] Stripe webhooks show successful delivery after test event  
- [ ] Admin user on `ADMIN_EMAIL_ALLOWLIST` can access admin-only routes  
- [ ] `validate-render-env.js` passes with production env snapshot

---

## References

- [b5-hardening-implementation-plan.md](./b5-hardening-implementation-plan.md)  
- [b5-production-hardening-analysis.md](./b5-production-hardening-analysis.md)  
- [b3-production-verification.md](./b3-production-verification.md)
