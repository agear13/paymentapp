# Shared Domain

This namespace is reserved for UI-agnostic business rules shared by Rabbit Hole and
Provvypay Agreements.

Ownership:

- `participants/`: participant business rules and lifecycle primitives.
- `agreements/`: agreement business rules and validation.
- `supplier-onboarding/`: supplier payment, ABN, GST, and verification rules.
- `settlements/`: payout readiness and release rules.
- `accounting/`: accounting health, profiles, and export readiness.
- `xero/`: Xero-specific domain adapters and token-safe integration logic.

Rules:

- Domain code may depend on shared repositories and plain data contracts.
- Domain code must not import React components or dashboard route modules.
- Rabbit Hole and Agreements may each have their own workflow orchestration layer
  that calls these shared domain services.
- Do not move runtime code here unless the move is behaviour-preserving and covered
  by tests.
