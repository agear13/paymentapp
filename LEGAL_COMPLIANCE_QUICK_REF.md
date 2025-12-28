# Legal Compliance Quick Reference

**Last Updated:** December 15, 2025  
**Version:** 1.0.0

---

## 📋 Quick Access

### Legal Documents
- **Terms of Service:** `/legal/terms`
- **Privacy Policy:** `/legal/privacy`
- **Cookie Policy:** `/legal/cookies`

### User Features
- **Privacy Settings:** `/dashboard/settings/privacy`
- **Data Export:** POST `/api/gdpr/export`
- **Data Deletion:** POST `/api/gdpr/delete`

### Developer Resources
- **Version History API:** GET `/api/legal/version-history/{documentType}`
- **Cookie Consent Component:** `src/components/legal/CookieConsent.tsx`

---

## 🍪 Cookie Consent

### Implementation
```tsx
// Already integrated in root layout
import CookieConsent from "@/components/legal/CookieConsent";

// In layout.tsx
<CookieConsent />
```

### Cookie Categories
| Category | Required | Purpose |
|----------|----------|---------|
| Essential | Yes | Authentication, payment, session |
| Analytics | No | Usage tracking, performance |
| Functionality | No | Preferences, settings |

### User Controls
1. **Accept All** - Enables all cookies
2. **Reject Non-Essential** - Essential only
3. **Customize** - Choose specific categories

### Storage
```typescript
// Stored in localStorage
localStorage.getItem('cookie_consent')
// Returns: { essential: true, analytics: boolean, functionality: boolean }
```

---

## 🔐 GDPR Data Rights

### Data Export (Article 15 & 20)

**Endpoint:** `POST /api/gdpr/export`

**Request:**
```json
{
  "format": "json" // or "csv"
}
```

**Response:**
- Downloadable JSON/CSV file
- Contains all user data
- Excludes sensitive tokens

**Data Included:**
- User account information
- Organizations
- Payment links & transactions
- Ledger entries
- Xero connections (non-sensitive)
- FX snapshots

### Data Deletion (Article 17)

**Endpoint:** `POST /api/gdpr/delete`

**Request:**
```json
{
  "confirm_email": "user@example.com",
  "reason": "Optional reason",
  "delete_financial_data": false
}
```

**Process:**
1. Email confirmation required
2. Checks for active payment links
3. Two deletion modes:
   - **Complete:** Deletes all data (where permitted)
   - **Anonymize:** Keeps financial records for 7 years

**Restrictions:**
- Cannot delete with active payment links
- Some data retained for legal compliance (7 years)

### Eligibility Check

**Endpoint:** `GET /api/gdpr/delete`

**Response:**
```json
{
  "eligible": true,
  "active_links": 0,
  "total_payment_links": 5,
  "organizations": 1,
  "message": "Your account is eligible for deletion."
}
```

---

## 📚 Version History

### API Usage

**Get All Versions:**
```bash
GET /api/legal/version-history/terms
GET /api/legal/version-history/privacy
GET /api/legal/version-history/cookies
```

**Get Current Version:**
```bash
GET /api/legal/version-history/terms?current=true
```

**Get Specific Version:**
```bash
GET /api/legal/version-history/terms?version=1.0.0
```

### Adding New Versions

Edit `src/lib/legal/version-history.ts`:

```typescript
export const termsHistory: DocumentHistory = {
  documentType: "terms",
  currentVersion: "1.1.0", // Update this
  versions: [
    {
      version: "1.1.0",
      effectiveDate: "January 1, 2026",
      lastUpdated: "December 20, 2025",
      changes: [
        "Updated payment terms",
        "Added new compliance requirements",
      ],
    },
    // ... previous versions
  ],
};
```

---

## 🎨 UI Components

### Cookie Consent Banner

**Auto-displays on first visit**
- 1-second delay after page load
- Fixed position at bottom
- Three action buttons
- Responsive design

**Customization:**
```tsx
<CookieConsent />
// No props needed - fully self-contained
```

### Legal Document Wrapper

**Usage:**
```tsx
import LegalDocument from "@/components/legal/LegalDocument";

<LegalDocument
  title="Terms of Service"
  effectiveDate="December 15, 2025"
  lastUpdated="December 15, 2025"
  version="1.0.0"
  sections={[
    { id: "section1", title: "Section Title" },
    // ... more sections
  ]}
>
  {/* Document content */}
</LegalDocument>
```

**Features:**
- Auto-generated table of contents
- Smooth scroll navigation
- Version history display
- Responsive layout

### Version History Component

**Usage:**
```tsx
import VersionHistory from "@/components/legal/VersionHistory";

<VersionHistory documentType="terms" />
```

**Features:**
- Shows current version
- Collapsible older versions
- Auto-fetches from API
- Loading states

---

## ✅ Compliance Checklist

### Before Production

- [ ] Legal team review of all documents
- [ ] Update business address in legal documents
- [ ] Configure jurisdiction in Terms (dispute resolution section)
- [ ] Test data export with real data
- [ ] Test data deletion flow
- [ ] Verify cookie consent on all browsers
- [ ] Test GDPR endpoints with edge cases
- [ ] Review retention periods with legal team

### Post-Launch Monitoring

- [ ] Monitor data export requests
- [ ] Monitor data deletion requests
- [ ] Track cookie consent rates
- [ ] Review legal document version history
- [ ] Update documents as regulations change
- [ ] Log all GDPR requests for audit trail

---

## 🔧 Troubleshooting

### Cookie Consent Not Showing
1. Check localStorage: `localStorage.getItem('cookie_consent')`
2. Clear localStorage to reset: `localStorage.removeItem('cookie_consent')`
3. Reload page

### Data Export Fails
1. Check authentication (user must be logged in)
2. Verify API endpoint is accessible
3. Check server logs for errors
4. Ensure database connection is working

### Data Deletion Blocked
1. Common causes:
   - Active payment links (status: OPEN or PENDING)
   - Email confirmation doesn't match
   - Authentication failure
2. Check eligibility first: `GET /api/gdpr/delete`
3. Cancel/complete active payment links

### Version History Not Loading
1. Check API endpoint: `/api/legal/version-history/{documentType}`
2. Verify documentType is valid: `terms`, `privacy`, or `cookies`
3. Check browser console for errors
4. Ensure version-history.ts has data

---

## 📊 Monitoring

### Metrics to Track

**Cookie Consent:**
- Acceptance rate (all cookies)
- Rejection rate (essential only)
- Customization rate

**GDPR Requests:**
- Data export requests per month
- Data deletion requests per month
- Average processing time
- Failed requests

**Legal Page Traffic:**
- Views per document
- Time on page
- Bounce rate
- Most viewed sections

### Logging

All GDPR operations are logged:
```typescript
console.log("GDPR Deletion Request:", {
  user_id,
  email,
  reason,
  delete_financial_data,
  timestamp,
});
```

---

## 🚨 Important Notes

### Data Retention
- **Financial records:** 7 years (tax compliance)
- **Transaction history:** 7 years (legal requirement)
- **Personal data:** Deleted on request
- **Anonymized data:** Retained as needed

### Legal Requirements
- Terms of Service are binding contract
- Privacy Policy is legally required (GDPR)
- Cookie consent required (ePrivacy Directive)
- CCPA compliance for California users

### Security
- All data encrypted in transit (TLS 1.3)
- Sensitive data encrypted at rest
- Access tokens never exported
- Email confirmation for deletion
- Authentication required for all GDPR endpoints

---

## 📞 Support

### For Users
- Privacy questions: privacy@provvypay.com
- Data requests: dpo@provvypay.com
- General support: support@provvypay.com

### For Developers
- See full documentation: `SPRINT16_COMPLETE.md`
- API documentation: (to be added)
- Legal team contact: legal@provvypay.com

---

## 🔄 Update Procedure

### Updating Legal Documents

1. **Update the document:**
   - Edit the page file (`src/app/(legal)/legal/{type}/page.tsx`)
   - Update content sections

2. **Update version history:**
   - Edit `src/lib/legal/version-history.ts`
   - Increment version number
   - Add changelog entries
   - Update effective date

3. **Notify users:**
   - Send email notification (Sprint 22+)
   - Display in-app notice
   - Update "Last Updated" date

4. **Legal review:**
   - Submit changes to legal team
   - Obtain approval
   - Document approval date

### Version Numbering

Follow semantic versioning:
- **Major (X.0.0):** Significant changes, may require re-acceptance
- **Minor (1.X.0):** New sections or clarifications
- **Patch (1.0.X):** Typo fixes, formatting

---

## 🎯 Best Practices

### Cookie Consent
1. Show banner on first visit only
2. Respect user choices
3. Make it easy to change preferences
4. Don't block content unnecessarily
5. Clearly explain cookie purposes

### GDPR Compliance
1. Respond to requests within 30 days
2. Verify user identity before export/deletion
3. Keep audit logs of all requests
4. Document legal basis for processing
5. Regular compliance reviews

### Legal Documents
1. Keep language clear and simple
2. Update regularly (at least annually)
3. Version all changes
4. Maintain change history
5. Get legal review before major changes

---

**Quick Reference Complete!** 📚

For detailed implementation guide, see `SPRINT16_COMPLETE.md`







