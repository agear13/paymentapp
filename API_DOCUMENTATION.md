# Provvypay API Documentation

**Version:** 1.0.0  
**Base URL:** `https://app.provvypay.com/api`  
**Authentication:** Clerk Session + Organization Context

---

## 📋 Table of Contents

- [Authentication](#authentication)
- [Payment Links API](#payment-links-api)
- [Notifications API](#notifications-api)
- [Reports API](#reports-api)
- [Xero Integration API](#xero-integration-api)
- [Webhooks](#webhooks)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## 🔐 Authentication

All API endpoints require authentication via Clerk session cookies. Users must be authenticated and have access to an organization.

### Headers

```http
Cookie: __session=<clerk_session_token>
```

### Organization Context

The API automatically scopes requests to the user's current organization based on their Clerk organization membership.

---

## 💳 Payment Links API

### Create Payment Link

**Endpoint:** `POST /api/payment-links`

**Request Body:**
```json
{
  "amount": "100.00",
  "currency": "USD",
  "description": "Payment for services",
  "invoice_reference": "INV-001",
  "customer_email": "customer@example.com",
  "customer_phone": "+1234567890",
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**Response:** `201 Created`
```json
{
  "paymentLink": {
    "id": "uuid",
    "short_code": "ABC12345",
    "status": "OPEN",
    "amount": "100.00",
    "currency": "USD",
    "description": "Payment for services",
    "invoice_reference": "INV-001",
    "customer_email": "customer@example.com",
    "expires_at": "2025-12-31T23:59:59.000Z",
    "created_at": "2025-12-16T10:00:00.000Z",
    "payment_url": "https://pay.provvypay.com/ABC12345"
  }
}
```

### List Payment Links

**Endpoint:** `GET /api/payment-links`

**Query Parameters:**
- `status` (optional): Filter by status (DRAFT, OPEN, PAID, EXPIRED, CANCELED)
- `limit` (optional): Number of results (default: 50, max: 100)
- `cursor` (optional): Cursor for pagination

**Response:** `200 OK`
```json
{
  "paymentLinks": [
    {
      "id": "uuid",
      "short_code": "ABC12345",
      "status": "PAID",
      "amount": "100.00",
      "currency": "USD",
      "created_at": "2025-12-16T10:00:00.000Z"
    }
  ],
  "nextCursor": "cursor_string"
}
```

### Get Payment Link

**Endpoint:** `GET /api/payment-links/:id`

**Response:** `200 OK`
```json
{
  "paymentLink": {
    "id": "uuid",
    "short_code": "ABC12345",
    "status": "PAID",
    "amount": "100.00",
    "currency": "USD",
    "description": "Payment for services",
    "payment_method": "HEDERA",
    "token_type": "AUDD",
    "transaction_id": "0.0.123@1234567.890",
    "created_at": "2025-12-16T10:00:00.000Z",
    "paid_at": "2025-12-16T10:05:00.000Z"
  }
}
```

**Note:** `paid_at` is derived from the latest `PAYMENT_CONFIRMED` event in `payment_events` (not a column on `payment_links`). It is an ISO timestamp when a confirmed payment exists, or `null` otherwise.

### Get Payment Link Status

**Endpoint:** `GET /api/payment-links/:id/status`

**Response:** `200 OK`
```json
{
  "status": "PAID",
  "payment_method": "HEDERA",
  "token_type": "AUDD",
  "amount_received": "100.000000",
  "transaction_id": "0.0.123@1234567.890",
  "confirmed_at": "2025-12-16T10:05:00.000Z"
}
```

---

## 🔔 Notifications API

### List Notifications

**Endpoint:** `GET /api/notifications`

**Query Parameters:**
- `unreadOnly` (optional): `true` to get only unread notifications
- `limit` (optional): Number of results (default: 50)

**Response:** `200 OK`
```json
{
  "notifications": [
    {
      "id": "uuid",
      "type": "PAYMENT_CONFIRMED",
      "title": "Payment Confirmed",
      "message": "Payment of USD 100.00 has been confirmed",
      "read": false,
      "created_at": "2025-12-16T10:05:00.000Z",
      "data": {
        "payment_link_id": "uuid",
        "short_code": "ABC12345",
        "amount": "100.00"
      }
    }
  ]
}
```

### Mark Notification as Read

**Endpoint:** `POST /api/notifications/:id/read`

**Response:** `200 OK`
```json
{
  "notification": {
    "id": "uuid",
    "read": true
  }
}
```

### Get Notification Preferences

**Endpoint:** `GET /api/notifications/preferences`

**Response:** `200 OK`
```json
{
  "preferences": {
    "payment_confirmed_email": true,
    "payment_failed_email": true,
    "xero_sync_failed_email": true,
    "weekly_summary_email": true,
    "payment_confirmed_inapp": true
  }
}
```

### Update Notification Preferences

**Endpoint:** `PUT /api/notifications/preferences`

**Request Body:**
```json
{
  "payment_confirmed_email": false,
  "weekly_summary_email": true
}
```

**Response:** `200 OK`

---

## 📊 Reports API

### Revenue Summary

**Endpoint:** `GET /api/reports/revenue-summary`

**Query Parameters:**
- `organizationId` (required): Organization UUID
- `startDate` (optional): ISO 8601 datetime
- `endDate` (optional): ISO 8601 datetime

**Response:** `200 OK`
```json
{
  "totalRevenue": 2730.00,
  "totalPayments": 95,
  "breakdown": {
    "stripe": {
      "count": 43,
      "revenue": 1234.00,
      "percentage": 45.2
    },
    "hedera_hbar": {
      "count": 20,
      "revenue": 567.00,
      "percentage": 20.8
    },
    "hedera_usdc": {
      "count": 23,
      "revenue": 678.00,
      "percentage": 24.8
    },
    "hedera_usdt": {
      "count": 4,
      "revenue": 123.00,
      "percentage": 4.5
    },
    "hedera_audd": {
      "count": 5,
      "revenue": 128.00,
      "percentage": 4.7
    }
  }
}
```

### Token Breakdown

**Endpoint:** `GET /api/reports/token-breakdown`

**Response:** `200 OK`
```json
{
  "breakdown": [
    {
      "label": "Stripe",
      "value": 45.2,
      "count": 43,
      "revenue": 1234.00,
      "color": "#635BFF"
    },
    {
      "label": "Hedera - AUDD",
      "value": 4.7,
      "count": 5,
      "revenue": 128.00,
      "color": "#00843D"
    }
  ],
  "totalRevenue": 2730.00
}
```

### Export Data (CSV)

**Endpoint:** `GET /api/reports/export`

**Query Parameters:**
- `organizationId` (required)
- `startDate` (optional)
- `endDate` (optional)

**Response:** `200 OK`
```
Content-Type: text/csv
Content-Disposition: attachment; filename="payments-export-2025-12-16.csv"

Date,Short Code,Status,Amount,Currency,Payment Method,Token Type,Description
2025-12-16,ABC12345,CONFIRMED,100.00,AUD,HEDERA,AUDD,"Payment for services"
```

---

## 🔄 Xero Integration API

### Connect to Xero

**Endpoint:** `GET /api/xero/connect`

Redirects to Xero OAuth authorization page.

### Disconnect from Xero

**Endpoint:** `POST /api/xero/disconnect`

**Response:** `200 OK`

### Get Xero Status

**Endpoint:** `GET /api/xero/status`

**Response:** `200 OK`
```json
{
  "connected": true,
  "tenant_id": "xero-tenant-id",
  "connected_at": "2025-12-01T10:00:00.000Z",
  "expires_at": "2025-12-31T10:00:00.000Z"
}
```

### Manual Replay Sync

**Endpoint:** `POST /api/xero/sync/replay`

**Request Body:**
```json
{
  "syncId": "uuid",
  "resetRetryCount": true
}
```

**Response:** `200 OK`

---

## 🔗 Webhooks

### Stripe Webhook

**Endpoint:** `POST /api/stripe/webhook`

**Headers:**
```http
Stripe-Signature: signature_value
```

**Events Handled:**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `checkout.session.completed`
- `checkout.session.expired`

### Resend Email Webhook

**Endpoint:** `POST /api/webhooks/resend`

**Events Handled:**
- `email.sent`
- `email.delivered`
- `email.opened`
- `email.clicked`
- `email.bounced`

---

## ⚠️ Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Rate Limit Exceeded |
| 500 | Internal Server Error |

### Error Codes

- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - No access to resource
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request data
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `INTERNAL_ERROR` - Server error

---

## 🚦 Rate Limiting

**Limits:**
- 100 requests per minute per IP
- 1000 requests per hour per organization

**Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

**Rate Limit Exceeded Response:**
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60

{
  "error": "Rate limit exceeded",
  "retry_after": 60
}
```

---

## 🔧 SDK & Code Examples

### Node.js Example

```javascript
const response = await fetch('https://app.provvypay.com/api/payment-links', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': `__session=${sessionToken}`
  },
  body: JSON.stringify({
    amount: '100.00',
    currency: 'USD',
    description: 'Payment for services'
  })
});

const { paymentLink } = await response.json();
console.log('Payment URL:', paymentLink.payment_url);
```

### Python Example

```python
import requests

response = requests.post(
    'https://app.provvypay.com/api/payment-links',
    json={
        'amount': '100.00',
        'currency': 'USD',
        'description': 'Payment for services'
    },
    cookies={'__session': session_token}
)

payment_link = response.json()['paymentLink']
print('Payment URL:', payment_link['payment_url'])
```

---

## 📞 Support

- **Documentation:** https://docs.provvypay.com
- **Email:** support@provvypay.com
- **Status Page:** https://status.provvypay.com

---

**Last Updated:** December 16, 2025  
**API Version:** 1.0.0







