# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: agreement-intelligence-p3e-coordination.spec.ts >> P3-E Agreement Intelligence participant coordination >> Operator coordinates a compensated participant without leaving Commercial OS
- Location: e2e\agreement-intelligence-p3e-coordination.spec.ts:277:7

# Error details

```
Test timeout of 900000ms exceeded.
```

```
Error: page.evaluate: TypeError: Failed to fetch
    at window.fetch (webpack-internal:///(app-pages-browser)/./lib/security/csrf-fetch.client.ts:59:16)
    at hasWorkflow (eval at evaluate (:302:30), <anonymous>:4:26)
    at eval (eval at evaluate (:302:30), <anonymous>:11:15)
    at UtilityScript.evaluate (<anonymous>:304:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```