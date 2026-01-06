#!/bin/bash
# Stripe Webhook Testing Script
# Usage: ./scripts/test-stripe-webhook.sh

set -e

echo "🧪 Stripe Webhook Testing Script"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Stripe CLI is installed
if ! command -v stripe &> /dev/null; then
    echo -e "${RED}❌ Stripe CLI not found${NC}"
    echo ""
    echo "Install Stripe CLI:"
    echo ""
    echo "macOS:"
    echo "  brew install stripe/stripe-cli/stripe"
    echo ""
    echo "Windows:"
    echo "  scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git"
    echo "  scoop install stripe"
    echo ""
    echo "Linux:"
    echo "  wget https://github.com/stripe/stripe-cli/releases/download/v1.19.4/stripe_1.19.4_linux_x86_64.tar.gz"
    echo "  tar -xvf stripe_1.19.4_linux_x86_64.tar.gz"
    echo "  sudo mv stripe /usr/local/bin/"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Stripe CLI installed${NC}"

# Check if logged in
if ! stripe --version &> /dev/null; then
    echo -e "${RED}❌ Not logged in to Stripe${NC}"
    echo "Run: stripe login"
    exit 1
fi

echo -e "${GREEN}✅ Logged in to Stripe${NC}"
echo ""

# Check if .env.local exists
if [ ! -f "src/.env.local" ]; then
    echo -e "${YELLOW}⚠️  .env.local not found${NC}"
    echo "Creating template..."
    cat > src/.env.local << EOF
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Get these from:
# 1. Stripe Dashboard: https://dashboard.stripe.com/test/apikeys
# 2. Run: stripe listen --forward-to http://localhost:3000/api/stripe/webhook
#    Copy the webhook secret from the output
EOF
    echo -e "${YELLOW}Created src/.env.local template${NC}"
    echo "Please fill in your Stripe keys and run this script again."
    exit 1
fi

echo -e "${GREEN}✅ .env.local exists${NC}"

# Check if required env vars are set
if grep -q "sk_test_\.\.\." src/.env.local; then
    echo -e "${YELLOW}⚠️  STRIPE_SECRET_KEY not configured${NC}"
    echo "Get your test key from: https://dashboard.stripe.com/test/apikeys"
    exit 1
fi

echo -e "${GREEN}✅ Environment variables configured${NC}"
echo ""

# Check if dev server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo -e "${RED}❌ Dev server not running${NC}"
    echo ""
    echo "Start the dev server in another terminal:"
    echo "  cd src"
    echo "  npm run dev"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Dev server running${NC}"
echo ""

# Main menu
echo "Select test option:"
echo ""
echo "1. Start webhook listener (run this first in a new terminal)"
echo "2. Trigger payment_intent.succeeded event"
echo "3. Trigger checkout.session.completed event"
echo "4. Trigger payment_intent.payment_failed event"
echo "5. Run all test events"
echo "6. Exit"
echo ""
read -p "Enter choice [1-6]: " choice

case $choice in
    1)
        echo ""
        echo -e "${YELLOW}Starting webhook listener...${NC}"
        echo ""
        echo "⚠️  IMPORTANT: Copy the webhook secret (whsec_...) and add it to src/.env.local"
        echo "Then restart your dev server: npm run dev"
        echo ""
        stripe listen --forward-to http://localhost:3000/api/stripe/webhook
        ;;
    2)
        echo ""
        echo -e "${YELLOW}Triggering payment_intent.succeeded...${NC}"
        stripe trigger payment_intent.succeeded
        echo ""
        echo -e "${GREEN}✅ Event sent!${NC}"
        echo "Check your terminal running 'npm run dev' for webhook logs"
        ;;
    3)
        echo ""
        echo -e "${YELLOW}Triggering checkout.session.completed...${NC}"
        stripe trigger checkout.session.completed
        echo ""
        echo -e "${GREEN}✅ Event sent!${NC}"
        echo "Check your terminal running 'npm run dev' for webhook logs"
        ;;
    4)
        echo ""
        echo -e "${YELLOW}Triggering payment_intent.payment_failed...${NC}"
        stripe trigger payment_intent.payment_failed
        echo ""
        echo -e "${GREEN}✅ Event sent!${NC}"
        echo "Check your terminal running 'npm run dev' for webhook logs"
        ;;
    5)
        echo ""
        echo -e "${YELLOW}Running all test events...${NC}"
        echo ""
        
        echo "1/4: payment_intent.succeeded"
        stripe trigger payment_intent.succeeded
        sleep 2
        
        echo "2/4: checkout.session.completed"
        stripe trigger checkout.session.completed
        sleep 2
        
        echo "3/4: payment_intent.payment_failed"
        stripe trigger payment_intent.payment_failed
        sleep 2
        
        echo "4/4: payment_intent.canceled"
        stripe trigger payment_intent.canceled
        
        echo ""
        echo -e "${GREEN}✅ All events sent!${NC}"
        echo "Check your terminal running 'npm run dev' for webhook logs"
        echo ""
        echo "Next steps:"
        echo "1. Check http://localhost:3000/dashboard/transactions"
        echo "2. Check http://localhost:3000/dashboard/ledger"
        ;;
    6)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "Done! 🎉"

