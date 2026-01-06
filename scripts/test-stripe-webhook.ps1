# Stripe Webhook Testing Script (PowerShell)
# Usage: .\scripts\test-stripe-webhook.ps1

Write-Host "🧪 Stripe Webhook Testing Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Stripe CLI is installed
$stripePath = Get-Command stripe -ErrorAction SilentlyContinue
if (-not $stripePath) {
    Write-Host "❌ Stripe CLI not found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Install Stripe CLI:"
    Write-Host ""
    Write-Host "Windows (Scoop):"
    Write-Host "  scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git"
    Write-Host "  scoop install stripe"
    Write-Host ""
    Write-Host "macOS:"
    Write-Host "  brew install stripe/stripe-cli/stripe"
    Write-Host ""
    exit 1
}

Write-Host "✅ Stripe CLI installed" -ForegroundColor Green

# Check if .env.local exists
if (-not (Test-Path "src\.env.local")) {
    Write-Host "⚠️  .env.local not found" -ForegroundColor Yellow
    Write-Host "Creating template..."
    
    $envTemplate = @"
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Get these from:
# 1. Stripe Dashboard: https://dashboard.stripe.com/test/apikeys
# 2. Run: stripe listen --forward-to http://localhost:3000/api/stripe/webhook
#    Copy the webhook secret from the output
"@
    
    $envTemplate | Out-File -FilePath "src\.env.local" -Encoding UTF8
    Write-Host "Created src\.env.local template" -ForegroundColor Yellow
    Write-Host "Please fill in your Stripe keys and run this script again."
    exit 1
}

Write-Host "✅ .env.local exists" -ForegroundColor Green

# Check if required env vars are set
$envContent = Get-Content "src\.env.local" -Raw
if ($envContent -match "sk_test_\.\.\.") {
    Write-Host "⚠️  STRIPE_SECRET_KEY not configured" -ForegroundColor Yellow
    Write-Host "Get your test key from: https://dashboard.stripe.com/test/apikeys"
    exit 1
}

Write-Host "✅ Environment variables configured" -ForegroundColor Green
Write-Host ""

# Check if dev server is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue
    Write-Host "✅ Dev server running" -ForegroundColor Green
} catch {
    Write-Host "❌ Dev server not running" -ForegroundColor Red
    Write-Host ""
    Write-Host "Start the dev server in another terminal:"
    Write-Host "  cd src"
    Write-Host "  npm run dev"
    Write-Host ""
    exit 1
}

Write-Host ""

# Main menu
Write-Host "Select test option:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Start webhook listener (run this first in a new terminal)"
Write-Host "2. Trigger payment_intent.succeeded event"
Write-Host "3. Trigger checkout.session.completed event"
Write-Host "4. Trigger payment_intent.payment_failed event"
Write-Host "5. Run all test events"
Write-Host "6. Exit"
Write-Host ""
$choice = Read-Host "Enter choice [1-6]"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Starting webhook listener..." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "⚠️  IMPORTANT: Copy the webhook secret (whsec_...) and add it to src\.env.local" -ForegroundColor Yellow
        Write-Host "Then restart your dev server: npm run dev"
        Write-Host ""
        stripe listen --forward-to http://localhost:3000/api/stripe/webhook
    }
    "2" {
        Write-Host ""
        Write-Host "Triggering payment_intent.succeeded..." -ForegroundColor Yellow
        stripe trigger payment_intent.succeeded
        Write-Host ""
        Write-Host "✅ Event sent!" -ForegroundColor Green
        Write-Host "Check your terminal running 'npm run dev' for webhook logs"
    }
    "3" {
        Write-Host ""
        Write-Host "Triggering checkout.session.completed..." -ForegroundColor Yellow
        stripe trigger checkout.session.completed
        Write-Host ""
        Write-Host "✅ Event sent!" -ForegroundColor Green
        Write-Host "Check your terminal running 'npm run dev' for webhook logs"
    }
    "4" {
        Write-Host ""
        Write-Host "Triggering payment_intent.payment_failed..." -ForegroundColor Yellow
        stripe trigger payment_intent.payment_failed
        Write-Host ""
        Write-Host "✅ Event sent!" -ForegroundColor Green
        Write-Host "Check your terminal running 'npm run dev' for webhook logs"
    }
    "5" {
        Write-Host ""
        Write-Host "Running all test events..." -ForegroundColor Yellow
        Write-Host ""
        
        Write-Host "1/4: payment_intent.succeeded"
        stripe trigger payment_intent.succeeded
        Start-Sleep -Seconds 2
        
        Write-Host "2/4: checkout.session.completed"
        stripe trigger checkout.session.completed
        Start-Sleep -Seconds 2
        
        Write-Host "3/4: payment_intent.payment_failed"
        stripe trigger payment_intent.payment_failed
        Start-Sleep -Seconds 2
        
        Write-Host "4/4: payment_intent.canceled"
        stripe trigger payment_intent.canceled
        
        Write-Host ""
        Write-Host "✅ All events sent!" -ForegroundColor Green
        Write-Host "Check your terminal running 'npm run dev' for webhook logs"
        Write-Host ""
        Write-Host "Next steps:"
        Write-Host "1. Check http://localhost:3000/dashboard/transactions"
        Write-Host "2. Check http://localhost:3000/dashboard/ledger"
    }
    "6" {
        Write-Host "Exiting..."
        exit 0
    }
    default {
        Write-Host "Invalid choice" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Done! 🎉" -ForegroundColor Green

