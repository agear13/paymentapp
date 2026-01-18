#!/bin/bash

##############################################################################
# Stripe Webhook Status Checker
# 
# This script helps diagnose Stripe webhook configuration issues
# 
# Usage: ./scripts/check-stripe-webhooks.sh
##############################################################################

echo "🔍 Checking Stripe Webhook Configuration..."
echo ""
echo "================================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.local exists
if [ -f .env.local ]; then
    echo "✅ Found .env.local"
    source .env.local
else
    echo "⚠️  No .env.local file found"
fi

# Check STRIPE_WEBHOOK_SECRET
echo ""
echo "1️⃣ Checking STRIPE_WEBHOOK_SECRET..."
if [ -z "$STRIPE_WEBHOOK_SECRET" ]; then
    echo -e "${RED}❌ STRIPE_WEBHOOK_SECRET is NOT set${NC}"
    echo ""
    echo "   🔧 Fix:"
    echo "   Add to .env.local:"
    echo "   STRIPE_WEBHOOK_SECRET=whsec_xxxxx"
    echo ""
    HAS_ERRORS=1
elif [ "$STRIPE_WEBHOOK_SECRET" == "disabled" ]; then
    echo -e "${YELLOW}⚠️  STRIPE_WEBHOOK_SECRET is DISABLED${NC}"
    HAS_ERRORS=1
else
    echo -e "${GREEN}✅ STRIPE_WEBHOOK_SECRET is set${NC}"
    # Check format
    if [[ $STRIPE_WEBHOOK_SECRET == whsec_* ]]; then
        echo -e "${GREEN}✅ Format is correct (starts with whsec_)${NC}"
    else
        echo -e "${RED}❌ Format is wrong (should start with whsec_)${NC}"
        HAS_ERRORS=1
    fi
fi

# Check STRIPE_SECRET_KEY
echo ""
echo "2️⃣ Checking STRIPE_SECRET_KEY..."
if [ -z "$STRIPE_SECRET_KEY" ]; then
    echo -e "${RED}❌ STRIPE_SECRET_KEY is NOT set${NC}"
    HAS_ERRORS=1
elif [[ $STRIPE_SECRET_KEY == sk_test_* ]]; then
    echo -e "${GREEN}✅ Using TEST mode${NC}"
elif [[ $STRIPE_SECRET_KEY == sk_live_* ]]; then
    echo -e "${YELLOW}⚠️  Using LIVE mode (production)${NC}"
else
    echo -e "${RED}❌ Invalid format${NC}"
    HAS_ERRORS=1
fi

# Check NEXT_PUBLIC_APP_URL
echo ""
echo "3️⃣ Checking NEXT_PUBLIC_APP_URL..."
if [ -z "$NEXT_PUBLIC_APP_URL" ]; then
    echo -e "${YELLOW}⚠️  NEXT_PUBLIC_APP_URL not set (defaulting to localhost)${NC}"
    NEXT_PUBLIC_APP_URL="http://localhost:3000"
else
    echo -e "${GREEN}✅ APP_URL: $NEXT_PUBLIC_APP_URL${NC}"
fi

WEBHOOK_URL="$NEXT_PUBLIC_APP_URL/api/stripe/webhook"
echo ""
echo "📍 Your webhook URL should be:"
echo "   $WEBHOOK_URL"

# Check if Stripe CLI is installed
echo ""
echo "4️⃣ Checking Stripe CLI..."
if command -v stripe &> /dev/null; then
    echo -e "${GREEN}✅ Stripe CLI is installed${NC}"
    STRIPE_VERSION=$(stripe --version)
    echo "   Version: $STRIPE_VERSION"
else
    echo -e "${YELLOW}⚠️  Stripe CLI not installed${NC}"
    echo ""
    echo "   🔧 Install:"
    echo "   Mac:     brew install stripe/stripe-cli/stripe"
    echo "   Windows: scoop install stripe"
fi

# Try to ping webhook endpoint
echo ""
echo "5️⃣ Testing webhook endpoint..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d '{}' 2>/dev/null || echo "000")

if [ "$HTTP_CODE" == "000" ]; then
    echo -e "${YELLOW}⚠️  Cannot reach endpoint (app may not be running)${NC}"
elif [ "$HTTP_CODE" == "400" ] || [ "$HTTP_CODE" == "401" ]; then
    echo -e "${GREEN}✅ Endpoint exists (returned $HTTP_CODE as expected)${NC}"
elif [ "$HTTP_CODE" == "200" ]; then
    echo -e "${GREEN}✅ Endpoint is responding${NC}"
else
    echo -e "${YELLOW}⚠️  Unexpected response: $HTTP_CODE${NC}"
fi

# Summary
echo ""
echo "================================================================"
echo ""
echo "📊 SUMMARY:"
echo ""

if [ -z "$HAS_ERRORS" ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Ensure webhook is created in Stripe Dashboard"
    echo "   2. Verify webhook URL: $WEBHOOK_URL"
    echo "   3. Test with: stripe trigger payment_intent.succeeded"
else
    echo -e "${RED}❌ Issues found! See errors above.${NC}"
    echo ""
    echo "📚 See STRIPE_WEBHOOK_DIAGNOSIS.md for detailed fix guide"
fi

echo ""

