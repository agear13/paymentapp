# Consultant UX: Ritual & BD Partner YouTube Funnel

## Behavioral Ritual

After each client session, consultants have two primary actions:

1. **+ Collect Review** — Send a review link to the client. The client gets a unique `/review/[token]` URL and can leave feedback without an account. Reviews build social proof and help the consultant’s reputation.

2. **+ Create Referral Link for Client** — Optional. Create a client advocate link with a configurable commission (0–50%). The client shares that link; when their referrals convert, they earn a commission and the consultant earns the remainder.

These are separate actions. You do not need to create an advocate link every time you collect a review.

## Progressive Disclosure

- **Empty state**: If the consultant has no advocates and no earnings, show a welcome card with “Here’s how it works” and two CTAs.
- **Split CTAs**: After each session, both CTAs are visible so the consultant can choose the right action.
- **Trust**: BD Partner commission is shown with a tooltip: “This goes to [name] who provided the tools and training.”

## BD Partner’s YouTube Funnel

1. BD partner promotes the software via YouTube and other channels.
2. Consultant signs up via the BD partner’s referral link (`/auth/signup?ref=BD_CODE`).
3. Consultant is onboarded and gets access to the consultant dashboard.
4. Consultant’s workflow:
   - Share their main link (`/r/[consultant_code]`) for direct referrals.
   - After each session: **Collect Review** or **Create Referral Link for Client** (or both).
5. When a client advocate’s referral converts:
   - BD partner receives `owner_percent`
   - Client advocate receives `custom_commission_percent` (set by consultant)
   - Consultant receives the remainder

## Share Templates

- **Review**: “Thanks for working with me — would you mind leaving a quick review? [link]”
- **Advocate**: “Here’s your referral link for [service]. Share it with anyone who might benefit — you’ll earn a commission: [link]”

## Status Mapping (Earnings)

- **Pending Approval**: conversion recorded; payout processing
- **Paid**: payment sent
- **Reversed**: entry was reversed

Estimated payout date: `created_at + 7 days` when status is pending.

## Advocate Management

- **Search**: Filter by name, email, or referral code
- **Sort**: Last activity / Most referrals / Highest earnings
- **Actions**: Copy, Share, Resend (for stale advocates), Edit (commission %)

## Clicks vs Conversions

If an advocate has clicks but no conversions:

- Show “X clicks, 0 bookings yet”
- “View analytics” opens a drawer with last 10 attributions (timestamp, landing path, user agent)
