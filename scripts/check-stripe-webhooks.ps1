##############################################################################
# Stripe Webhook Status Checker (PowerShell)
# 
# This script helps diagnose Stripe webhook configuration issues
# 
# Usage: .\scripts\check-stripe-webhooks.ps1
##############################################################################

Write-Host "`n🔍 Checking Stripe Webhook Configuration...`n" -ForegroundColor Cyan
Write-Host "================================================================`n"

$hasErrors = $false

# Check STRIPE_WEBHOOK_SECRET
Write-Host "1️⃣ Checking STRIPE_WEBHOOK_SECRET..." -ForegroundColor Yellow

if (-not $env:STRIPE_WEBHOOK_SECRET) {
    Write-Host "❌ STRIPE_WEBHOOK_SECRET is NOT set" -ForegroundColor Red
    Write-Host "`n   🔧 Fix:" -ForegroundColor Yellow
    Write-Host "   Add to .env.local:"
    Write-Host "   STRIPE_WEBHOOK_SECRET=whsec_xxxxx`n"
    $hasErrors = $true
}
elseif ($env:STRIPE_WEBHOOK_SECRET -eq "disabled") {
    Write-Host "⚠️  STRIPE_WEBHOOK_SECRET is DISABLED" -ForegroundColor Yellow
    $hasErrors = $true
}
else {
    Write-Host "✅ STRIPE_WEBHOOK_SECRET is set" -ForegroundColor Green
    
    # Check format
    if ($env:STRIPE_WEBHOOK_SECRET.StartsWith("whsec_")) {
        Write-Host "✅ Format is correct (starts with whsec_)" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Format is wrong (should start with whsec_)" -ForegroundColor Red
        $hasErrors = $true
    }
}

# Check STRIPE_SECRET_KEY
Write-Host "`n2️⃣ Checking STRIPE_SECRET_KEY..." -ForegroundColor Yellow

if (-not $env:STRIPE_SECRET_KEY) {
    Write-Host "❌ STRIPE_SECRET_KEY is NOT set" -ForegroundColor Red
    $hasErrors = $true
}
elseif ($env:STRIPE_SECRET_KEY.StartsWith("sk_test_")) {
    Write-Host "✅ Using TEST mode" -ForegroundColor Green
}
elseif ($env:STRIPE_SECRET_KEY.StartsWith("sk_live_")) {
    Write-Host "⚠️  Using LIVE mode (production)" -ForegroundColor Yellow
}
else {
    Write-Host "❌ Invalid format" -ForegroundColor Red
    $hasErrors = $true
}

# Check NEXT_PUBLIC_APP_URL
Write-Host "`n3️⃣ Checking NEXT_PUBLIC_APP_URL..." -ForegroundColor Yellow

if (-not $env:NEXT_PUBLIC_APP_URL) {
    Write-Host "⚠️  NEXT_PUBLIC_APP_URL not set (defaulting to localhost)" -ForegroundColor Yellow
    $appUrl = "http://localhost:3000"
}
else {
    Write-Host "✅ APP_URL: $env:NEXT_PUBLIC_APP_URL" -ForegroundColor Green
    $appUrl = $env:NEXT_PUBLIC_APP_URL
}

$webhookUrl = "$appUrl/api/stripe/webhook"
Write-Host "`n📍 Your webhook URL should be:"
Write-Host "   $webhookUrl" -ForegroundColor Cyan

# Check if Stripe CLI is installed
Write-Host "`n4️⃣ Checking Stripe CLI..." -ForegroundColor Yellow

$stripeCli = Get-Command stripe -ErrorAction SilentlyContinue

if ($stripeCli) {
    Write-Host "✅ Stripe CLI is installed" -ForegroundColor Green
    $version = & stripe --version 2>&1
    Write-Host "   Version: $version"
}
else {
    Write-Host "⚠️  Stripe CLI not installed" -ForegroundColor Yellow
    Write-Host "`n   🔧 Install:"
    Write-Host "   scoop bucket add stripe https://github.com/stripe/scoop-stripe-cli.git"
    Write-Host "   scoop install stripe`n"
}

# Try to ping webhook endpoint
Write-Host "`n5️⃣ Testing webhook endpoint..." -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri $webhookUrl -Method POST `
        -ContentType "application/json" `
        -Body '{}' `
        -ErrorAction SilentlyContinue `
        -TimeoutSec 5
    
    $statusCode = $response.StatusCode
    
    if ($statusCode -eq 200) {
        Write-Host "✅ Endpoint is responding" -ForegroundColor Green
    }
}
catch {
    $statusCode = $_.Exception.Response.StatusCode.value__
    
    if ($statusCode -eq 400 -or $statusCode -eq 401) {
        Write-Host "✅ Endpoint exists (returned $statusCode as expected)" -ForegroundColor Green
    }
    elseif ($statusCode) {
        Write-Host "⚠️  Unexpected response: $statusCode" -ForegroundColor Yellow
    }
    else {
        Write-Host "⚠️  Cannot reach endpoint (app may not be running)" -ForegroundColor Yellow
    }
}

# Summary
Write-Host "`n================================================================`n"
Write-Host "📊 SUMMARY:`n" -ForegroundColor Cyan

if (-not $hasErrors) {
    Write-Host "✅ All checks passed!`n" -ForegroundColor Green
    Write-Host "📝 Next steps:"
    Write-Host "   1. Ensure webhook is created in Stripe Dashboard"
    Write-Host "   2. Verify webhook URL: $webhookUrl"
    Write-Host "   3. Test with: stripe trigger payment_intent.succeeded"
}
else {
    Write-Host "❌ Issues found! See errors above.`n" -ForegroundColor Red
    Write-Host "📚 See STRIPE_WEBHOOK_DIAGNOSIS.md for detailed fix guide"
}

Write-Host ""

