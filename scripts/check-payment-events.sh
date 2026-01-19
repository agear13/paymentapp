#!/bin/bash
##############################################################################
# Check Stripe Payment Events
# Helps diagnose why webhooks aren't being delivered
##############################################################################

echo "🔍 Stripe Payment Events Checker"
echo ""
echo "This script helps verify your Stripe configuration."
echo ""

# Check environment variables
echo "1️⃣ Checking Environment Variables..."
echo ""

if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo "❌ STRIPE_SECRET_KEY not set"
    echo "   Set it in .env.local or environment"
    exit 1
fi

if [[ $STRIPE_SECRET_KEY == sk_test_* ]]; then
    echo "✅ Using TEST mode"
    MODE="test"
elif [[ $STRIPE_SECRET_KEY == sk_live_* ]]; then
    echo "⚠️  Using LIVE mode"
    MODE="live"
else
    echo "❌ Invalid STRIPE_SECRET_KEY format"
    exit 1
fi

echo ""
echo "2️⃣ Instructions for Manual Verification:"
echo ""
echo "Go to: https://dashboard.stripe.com/$MODE/payments"
echo ""
echo "Find your most recent payment and check:"
echo ""
echo "  1. Click on the payment"
echo "  2. Scroll to 'Events and logs' section"
echo "  3. Find 'payment_intent.succeeded' event"
echo "  4. Click on it"
echo "  5. Check if it says:"
echo "     - 'Sent to 1 endpoint' (✅ webhook sent)"
echo "     - 'No webhooks configured' (❌ problem)"
echo ""
echo "Then go to: https://dashboard.stripe.com/$MODE/webhooks"
echo ""
echo "Check your webhook endpoint:"
echo ""
echo "  1. Click on the endpoint"
echo "  2. Verify Status is 'Enabled'"
echo "  3. Verify URL matches your Render app"
echo "  4. Check 'Recent deliveries' for your payment"
echo ""

if [ ! -z "$STRIPE_WEBHOOK_SECRET" ]; then
    if [[ $STRIPE_WEBHOOK_SECRET == whsec_* ]]; then
        echo "✅ STRIPE_WEBHOOK_SECRET is set correctly"
    elif [ "$STRIPE_WEBHOOK_SECRET" == "disabled" ]; then
        echo "❌ STRIPE_WEBHOOK_SECRET is 'disabled'"
        echo "   Get the real secret from Stripe Dashboard"
    else
        echo "⚠️  STRIPE_WEBHOOK_SECRET doesn't look right"
        echo "   Should start with 'whsec_'"
    fi
else
    echo "❌ STRIPE_WEBHOOK_SECRET not set"
fi

echo ""
echo "3️⃣ Common Issues:"
echo ""
echo "Issue: Events configured but no deliveries"
echo "Cause: Webhook might be for different Stripe account"
echo "Fix:   Verify API keys match the account with webhook"
echo ""
echo "Issue: Payment succeeds but webhook not triggered"
echo "Cause: Webhook might be disabled or URL is wrong"
echo "Fix:   Check webhook status and URL in Stripe"
echo ""
echo "Issue: Webhook delivers but app doesn't process"
echo "Cause: STRIPE_WEBHOOK_SECRET wrong or 'disabled'"
echo "Fix:   Update secret in Render environment"
echo ""

if [ ! -z "$NEXT_PUBLIC_APP_URL" ]; then
    echo "4️⃣ Your webhook URL should be:"
    echo ""
    echo "   $NEXT_PUBLIC_APP_URL/api/stripe/webhook"
    echo ""
    echo "   Verify this EXACTLY matches what's in Stripe Dashboard"
    echo ""
fi

echo "5️⃣ Quick Test:"
echo ""
echo "   1. Go to Stripe webhook in Dashboard"
echo "   2. Click 'Send test webhook'"
echo "   3. Select 'payment_intent.succeeded'"
echo "   4. Click 'Send test webhook'"
echo "   5. Should return 200 OK"
echo "   6. Check Render logs immediately"
echo ""

