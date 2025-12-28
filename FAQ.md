# Frequently Asked Questions (FAQ)

Common questions about Provvypay payment processing.

---

## 🏦 General

### What is Provvypay?

Provvypay is a payment processing platform that allows merchants to accept payments via:
- **Credit/Debit Cards** (via Stripe)
- **Cryptocurrency** (via Hedera network)

With automatic syncing to Xero accounting software.

### What currencies are supported?

**Fiat Currencies:**
- USD, AUD, EUR, GBP, CAD, and 100+ others

**Cryptocurrencies:**
- HBAR (Hedera native token)
- USDC (USD stablecoin)
- USDT (Tether stablecoin)
- **AUDD** (Australian Dollar stablecoin) ⭐

### How much does it cost?

**Stripe Payments:**
- Stripe's standard fees apply (typically 2.9% + $0.30)

**Hedera Payments:**
- Network fees: ~$0.0001 USD per transaction
- No Provvypay fee for crypto payments

**Platform:**
- **Free tier:** Up to 100 transactions/month
- **Pro:** Unlimited transactions - Contact sales

---

## 💳 Payment Methods

### Can customers pay with credit cards?

Yes! Via Stripe integration. Customers can use:
- Credit cards (Visa, Mastercard, Amex)
- Debit cards
- Apple Pay
- Google Pay

### What cryptocurrencies do you support?

**On Hedera Network:**
- **HBAR** - Native Hedera token
- **USDC** - Circle USD stablecoin
- **USDT** - Tether stablecoin
- **AUDD** - Australian Dollar stablecoin ⭐

### Why Hedera? Why not Bitcoin or Ethereum?

**Hedera advantages:**
- ⚡ Fast: 3-5 second finality
- 💰 Cheap: $0.0001 per transaction
- 🌍 Green: Carbon negative
- 🔒 Secure: aBFT consensus
- 📊 Enterprise: Governed by global companies

### Do customers need a wallet for crypto payments?

Yes, customers need a Hedera wallet:
- **HashPack** (recommended)
- **Blade Wallet**
- **Kabila**
- Any WalletConnect compatible wallet

---

## 🔗 Payment Links

### How long are payment links valid?

**Default:** 30 days from creation

**Custom:** You can set any expiry date when creating the link.

**Recommendation:** 7-14 days for invoices, 1-2 days for quotes.

### Can I reuse a payment link?

No. Each payment link is single-use. Once paid, it cannot be used again.

**Best practice:** Create a new payment link for each invoice or transaction.

### Can customers pay more than once?

No. Payment links are single-use. After successful payment, the link is marked as PAID and becomes inactive.

### What happens if a payment link expires?

**Status changes to EXPIRED** and:
- Link becomes inactive
- Customer sees "Payment link expired" message
- No payment can be made

**Solution:** Create a new payment link with updated expiry date.

---

## 💰 Cryptocurrency Payments

### How do customers know how much crypto to send?

The payment page shows:
- Exact amount in crypto (e.g., "100.000000 AUDD")
- Current exchange rate
- Merchant's Hedera account ID

The amount is calculated using real-time exchange rates with 0.1% tolerance.

### What if the exchange rate changes?

**0.1% tolerance** is built in to account for small rate fluctuations during payment.

**If rate changes significantly:**
- Payment may fail
- Customer can retry with updated amount

### What if customer sends wrong amount?

**Underpayment:** Payment fails, funds returned (minus network fees)

**Overpayment:** Payment succeeds, excess is kept by merchant

**Wrong token:** Payment fails, customer keeps funds

### What if customer sends wrong token?

**Example:** Customer sends USDC but link expects AUDD

**Result:**
- Payment not detected
- No credit given
- Funds remain in customer's control

**Prevention:** Clear instructions on payment page showing exact token required.

### How long does crypto confirmation take?

**Hedera Network:**
- Transaction finality: 3-5 seconds
- Mirror node update: 10-30 seconds
- **Total time:** Usually under 1 minute

### Can I refund crypto payments?

**Manual process:** Provvypay doesn't have automatic crypto refunds.

**To refund:**
1. Send crypto manually from your wallet
2. To customer's Hedera account
3. Update payment status in your records

**Why manual?** Blockchain transactions are immutable and irreversible.

---

## 🔄 Xero Integration

### Do I need Xero?

No, Xero integration is optional. You can use Provvypay without Xero.

**Benefits of Xero integration:**
- Automatic invoice creation
- Automatic payment recording
- Proper double-entry bookkeeping
- Reconciliation reports

### How often does data sync to Xero?

**Automatically** - Immediately after payment confirmation.

**Retry Logic:**
- If sync fails, automatic retry with exponential backoff
- Up to 6 retry attempts over 6 hours

### What gets synced to Xero?

**For each payment:**
1. Invoice (Accounts Receivable)
2. Payment against invoice
3. Processor fees (if applicable)

**Ledger entries:**
- DR: Clearing Account (by payment method)
- CR: Revenue
- DR: Fee Expense (if applicable)
- CR: Clearing Account

### Can I sync old payments?

**Manual replay:** Yes, from Admin → Queue dashboard.

**Bulk replay:** Contact support for assistance.

### How are crypto payments recorded in Xero?

**Each token has its own clearing account:**
- Account 1051: HBAR
- Account 1052: USDC
- Account 1053: USDT
- **Account 1054: AUDD** ⭐

**Narration includes:** Payment method and token type (e.g., "HEDERA_AUDD")

---

## 📊 Reporting

### What reports are available?

**Revenue Reports:**
- Revenue Summary - Total revenue by payment method
- Token Breakdown - Distribution across 5 payment methods
- Time Series - Revenue trends over time

**Financial Reports:**
- Ledger Balance - Current account balances
- Reconciliation - Expected vs. actual revenue

**Admin Reports:**
- Sync Queue Status
- Error Logs
- Orphan Detection

### Can I export data?

**Yes!** Export to CSV from Reports → Export

**Includes:**
- Date
- Short Code
- Status
- Amount
- Currency
- Payment Method
- **Token Type** (shows AUDD, USDC, etc.)
- Description
- Invoice Reference

### How do I see AUDD payments?

**Token Breakdown Report:**
Shows all 5 payment methods including:
- 💳 Stripe
- ℏ Hedera - HBAR
- 💵 Hedera - USDC
- 💰 Hedera - USDT
- 🇦🇺 **Hedera - AUDD**

**CSV Export:**
Has "Token Type" column showing "AUDD" for AUDD payments.

---

## 🔔 Notifications

### What notifications do I receive?

**Email Notifications:**
- Payment confirmations
- Payment failures
- Xero sync failures
- Weekly summaries

**In-App Notifications:**
- Bell icon in dashboard
- Real-time updates
- Unread badge

### Can I disable notifications?

Yes! Go to **Settings → Notifications**

**Granular control:**
- Enable/disable per notification type
- Separate email vs. in-app settings

### Why didn't I receive an email?

**Check:**
1. Spam/junk folder
2. Email address is correct in settings
3. Notification preferences enabled
4. Email logs for delivery status (Admin → Email Logs)

---

## 🔐 Security

### Is my data secure?

**Yes!** Security measures include:
- 🔒 HTTPS encryption (TLS 1.3)
- 🔑 Clerk authentication
- 🛡️ CSRF protection
- 📝 Audit logging
- 🔐 Encrypted secrets
- 🚦 Rate limiting

### How is sensitive data stored?

**Encrypted at rest:**
- Xero tokens
- Stripe keys
- API secrets

**Never stored:**
- Credit card numbers (handled by Stripe)
- Private keys (handled by customer wallets)

### What about PCI compliance?

**We don't touch card data.** All credit card processing is handled by Stripe (PCI Level 1 certified).

**Your responsibilities:**
- Don't store card numbers
- Don't email card details
- Use Provvypay payment links only

### Can I use this in production?

**Yes!** Provvypay is production-ready with:
- Comprehensive testing
- Error handling
- Monitoring
- Audit trails
- GDPR compliance

---

## 🛠️ Technical

### What is the API rate limit?

**Limits:**
- 100 requests per minute per IP
- 1000 requests per hour per organization

**Headers show:**
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

### Is there an API?

**Yes!** RESTful API with:
- Create payment links
- Check payment status
- Manage notifications
- Generate reports

**Documentation:** See `API_DOCUMENTATION.md`

### Can I integrate Provvypay into my app?

**Yes!** Options:
1. **REST API** - Full programmatic access
2. **Webhooks** - Real-time payment notifications
3. **Embed** - iFrame payment pages (coming soon)

### What technologies does Provvypay use?

**Frontend:**
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Shadcn UI

**Backend:**
- Next.js API Routes
- Prisma ORM
- PostgreSQL
- Clerk Auth

**Integrations:**
- Stripe SDK
- Xero SDK
- Hedera SDK (HashConnect)
- Resend (email)

---

## 💡 Best Practices

### How should I price in crypto?

**Options:**

1. **Fiat-denominated:** Price in USD/AUD, accept crypto equivalent
   - Example: $100 USD = ~X AUDD at current rate
   - ✅ Simple for customers
   - ❌ Rate fluctuation risk

2. **Crypto-denominated:** Price directly in crypto
   - Example: 100 AUDD
   - ✅ No rate risk
   - ❌ Harder for fiat-thinking customers

**Recommendation:** Fiat-denominated for most merchants.

### Should I use test mode first?

**Absolutely!**

**Test Mode checklist:**
1. Use Stripe test cards
2. Use Hedera testnet
3. Create test payment links
4. Complete test payments
5. Verify Xero sync (test org)
6. Check reports

**Only go live after:**
- Successful test transactions
- Xero sync working
- Comfortable with flow

### How often should I reconcile?

**Recommended frequency:**
- **Daily:** For high-volume merchants
- **Weekly:** For moderate volume
- **Monthly:** For low volume

**Where:** Dashboard → Reports → Reconciliation

---

## 🆘 Support

### How do I get help?

**Documentation:**
- API: `API_DOCUMENTATION.md`
- Onboarding: `MERCHANT_ONBOARDING_GUIDE.md`
- Xero: `XERO_INTEGRATION_GUIDE.md`
- This FAQ

**Contact:**
- Email: support@provvypay.com
- In-app: Click help icon (?)

**Response Times:**
- Critical: 1 hour
- General: 24 hours

### What's considered a critical issue?

**Critical (1 hour response):**
- Payment links not working
- Payments not being detected
- System downtime
- Data loss

**Non-critical (24 hours):**
- Questions
- Feature requests
- Report issues
- Cosmetic bugs

---

## 🚀 Future Features

### What's coming next?

**Planned features:**
- More cryptocurrencies
- Recurring payments
- Payment schedules
- Mobile app
- Advanced analytics
- Custom branding
- Multi-user teams

**Request features:** support@provvypay.com

---

**Last Updated:** December 16, 2025  
**Version:** 1.0







