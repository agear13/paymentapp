# Provvypay Local Development Setup

**Version:** 1.0  
**Last Updated:** December 16, 2025  
**Target Audience:** Developers

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Development Tools](#development-tools)
5. [Running the Application](#running-the-application)
6. [Testing](#testing)
7. [Troubleshooting](#troubleshooting)
8. [IDE Configuration](#ide-configuration)

---

## ✅ Prerequisites

### Required Software

| Software | Version | Installation |
|----------|---------|--------------|
| **Node.js** | 18.x or higher (LTS) | [nodejs.org](https://nodejs.org) |
| **npm** | 9.x or higher | Included with Node.js |
| **Git** | 2.x or higher | [git-scm.com](https://git-scm.com) |
| **PostgreSQL** | 15.x or higher | [Supabase](https://supabase.com) (recommended) |

### Optional but Recommended

| Software | Purpose |
|----------|---------|
| **VS Code** | Recommended IDE |
| **Docker** | For local PostgreSQL (alternative to Supabase) |
| **Stripe CLI** | For local webhook testing |
| **Postman** | For API testing |

### Verify Installation

```bash
# Check Node.js version (should be 18.x or higher)
node --version
# Expected output: v18.17.0 or higher

# Check npm version
npm --version
# Expected output: 9.6.7 or higher

# Check Git version
git --version
# Expected output: git version 2.x.x
```

---

## ⚡ Quick Start

For experienced developers who want to get started immediately:

```bash
# 1. Clone the repository
git clone https://github.com/provvypay/provvypay.git
cd provvypay/src

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp env.local.example env.local
# Edit env.local with your credentials

# 4. Set up database
npm run db:migrate:deploy
npm run db:seed

# 5. Run development server
npm run dev

# 6. Open browser
# Navigate to http://localhost:3000
```

---

## 🔧 Detailed Setup

### Step 1: Clone the Repository

```bash
# Clone from GitHub
git clone https://github.com/provvypay/provvypay.git

# Navigate to src directory
cd provvypay/src
```

### Step 2: Install Dependencies

```bash
# Install all dependencies
npm install

# This will install:
# - Next.js 15.5.7
# - React 19.1.0
# - Prisma 6.1.0
# - And 80+ other packages
```

**Expected Output:**
```
added 95 packages, and audited 96 packages in 30s
found 0 vulnerabilities
```

### Step 3: Configure Environment Variables

#### Create Environment File

```bash
# Copy example environment file
cp env.local.example env.local
```

#### Edit `env.local`

```bash
# Database (Supabase)
DATABASE_URL="postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres?pgbouncer=true&connection_limit=1"
DIRECT_URL="postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres"

# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL="https://[PROJECT-REF].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[ANON_KEY]"
SUPABASE_SERVICE_ROLE_KEY="[SERVICE_ROLE_KEY]"

# Stripe (TEST KEYS for local development)
STRIPE_SECRET_KEY="sk_test_[YOUR_KEY]"
STRIPE_PUBLISHABLE_KEY="pk_test_[YOUR_KEY]"
STRIPE_WEBHOOK_SECRET="whsec_[YOUR_SECRET]"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_[YOUR_KEY]"

# Hedera (TESTNET for local development)
NEXT_PUBLIC_HEDERA_NETWORK="testnet"
NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL="https://testnet.mirrornode.hedera.com"
NEXT_PUBLIC_HEDERA_MERCHANT_ACCOUNT_ID="0.0.XXXXXX"

# Xero (TEST APP)
XERO_CLIENT_ID="[YOUR_CLIENT_ID]"
XERO_CLIENT_SECRET="[YOUR_CLIENT_SECRET]"
XERO_REDIRECT_URI="http://localhost:3000/api/xero/callback"

# Redis (Upstash - Free tier available)
UPSTASH_REDIS_REST_URL="https://[YOUR_ENDPOINT].upstash.io"
UPSTASH_REDIS_REST_TOKEN="[YOUR_TOKEN]"

# Email (Resend - Free tier: 100 emails/day)
RESEND_API_KEY="re_[YOUR_KEY]"
RESEND_FROM_EMAIL="onboarding@resend.dev"  # Use Resend test domain

# Encryption (Generate new key for local dev)
ENCRYPTION_KEY="[32-byte-hex-string]"

# Monitoring (Optional for local dev)
SENTRY_DSN=""  # Leave empty for local dev

# CoinGecko (Optional - public API works without key)
COINGECKO_API_KEY=""

# Application
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

#### Generate Encryption Key

```bash
# Generate a secure 32-byte encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Copy the output to ENCRYPTION_KEY in env.local
```

### Step 4: Set Up Database

#### Option A: Use Supabase (Recommended)

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Click "New Project"
   - Choose a name and region
   - Save the database password

2. **Get Connection String**
   - Project Settings → Database
   - Copy "Connection Pooling" URL (with pgbouncer)
   - Copy "Direct Connection" URL
   - Update `DATABASE_URL` and `DIRECT_URL` in `env.local`

3. **Run Migrations**
   ```bash
   # Generate Prisma Client
   npm run db:generate
   
   # Run database migrations
   npm run db:migrate:deploy
   ```

4. **Seed Database (Optional)**
   ```bash
   # Seed default ledger accounts and sample data
   npm run db:seed
   ```

#### Option B: Local PostgreSQL with Docker

```bash
# Start PostgreSQL with Docker
docker run --name provvypay-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=provvypay \
  -p 5432:5432 \
  -d postgres:15

# Update env.local
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/provvypay"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/provvypay"

# Run migrations
npm run db:migrate:deploy
```

### Step 5: Set Up External Services

#### Stripe (Test Mode)

1. **Create Stripe Account**
   - Go to [stripe.com](https://stripe.com)
   - Sign up (free)

2. **Get Test API Keys**
   - Dashboard → Developers → API keys
   - Copy "Publishable key" (starts with `pk_test_`)
   - Copy "Secret key" (starts with `sk_test_`)
   - Update `env.local`

3. **Set Up Local Webhook Testing**
   ```bash
   # Install Stripe CLI
   # macOS
   brew install stripe/stripe-cli/stripe
   
   # Windows (with Scoop)
   scoop install stripe
   
   # Linux
   # Download from https://stripe.com/docs/stripe-cli
   
   # Login
   stripe login
   
   # Forward webhooks to local server
   npm run stripe:listen
   
   # Copy webhook signing secret to env.local
   STRIPE_WEBHOOK_SECRET="whsec_xxxxx"
   ```

#### Xero (Test App)

1. **Create Xero Developer Account**
   - Go to [developer.xero.com](https://developer.xero.com)
   - Sign up (free)

2. **Create App**
   - My Apps → New App
   - Name: "Provvypay Local Dev"
   - Redirect URI: `http://localhost:3000/api/xero/callback`
   - Copy Client ID and Secret
   - Update `env.local`

#### Redis (Upstash)

1. **Create Upstash Account**
   - Go to [upstash.com](https://upstash.com)
   - Sign up (free tier available)

2. **Create Redis Database**
   - Create Database
   - Choose region (closest to you)
   - Copy REST URL and Token
   - Update `env.local`

#### Resend (Email)

1. **Create Resend Account**
   - Go to [resend.com](https://resend.com)
   - Sign up (free tier: 100 emails/day)

2. **Get API Key**
   - API Keys → Create API Key
   - Copy key
   - Update `env.local`
   - Use `onboarding@resend.dev` for testing (no domain setup required)

#### Hedera Testnet

1. **Create Testnet Account**
   - Go to [portal.hedera.com](https://portal.hedera.com)
   - Create testnet account (free)
   - Fund with testnet HBAR (from portal)
   - Copy account ID (format: 0.0.xxxxx)
   - Update `env.local`

2. **Install HashPack Wallet**
   - Go to [hashpack.app](https://hashpack.app)
   - Install browser extension
   - Create wallet
   - Switch to testnet
   - Fund wallet with testnet HBAR

---

## 🛠️ Development Tools

### Prisma Studio (Database GUI)

```bash
# Open Prisma Studio (visual database editor)
npm run db:studio

# Opens at http://localhost:5555
```

### Stripe CLI

```bash
# Forward webhooks to local server
npm run stripe:listen

# Test webhook
stripe trigger payment_intent.succeeded
```

### Database Commands

```bash
# Generate Prisma Client
npm run db:generate

# Create new migration
npm run db:migrate

# Apply migrations
npm run db:migrate:deploy

# Reset database (CAUTION: deletes all data)
npm run db:reset

# Seed database
npm run db:seed
```

---

## 🏃 Running the Application

### Start Development Server

```bash
# Start Next.js development server with Turbopack
npm run dev

# Server starts at http://localhost:3000
```

**Expected Output:**
```
  ▲ Next.js 15.5.7
  - Local:        http://localhost:3000
  - Turbopack:    enabled

 ✓ Ready in 1.2s
```

### Open Application

1. **Navigate to:** `http://localhost:3000`
2. **Sign up** with a test email
3. **Create organization**
4. **Configure merchant settings**
5. **Create your first payment link**

### Available Scripts

```bash
# Development (with Turbopack)
npm run dev

# Build for production
npm run build

# Start production server (must build first)
npm run start

# Linting
npm run lint

# Testing
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

---

## 🧪 Testing

### Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- payment-service.test.ts

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

### Test Structure

```
src/
├── __tests__/
│   ├── integration/        # Integration tests
│   │   └── payment-flow.test.ts
│   └── performance/        # Performance tests
│       └── database-query.test.ts
├── components/
│   └── __tests__/         # Component tests
│       └── Button.test.tsx
└── lib/
    └── __tests__/         # Unit tests
        └── payment-service.test.ts
```

### Writing Tests

```typescript
// Example: src/lib/__tests__/payment-service.test.ts
import { createPaymentLink } from '@/lib/payment-link/payment-link-service';
import { prismaMock } from '@/lib/test-utils/prisma-mock';

describe('PaymentLinkService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPaymentLink', () => {
    it('should create payment link successfully', async () => {
      const mockData = {
        organizationId: 'org-123',
        amount: 100.00,
        currency: 'USD',
        description: 'Test payment'
      };

      prismaMock.payment_links.create.mockResolvedValue({
        id: 'link-123',
        ...mockData,
        status: 'DRAFT',
        short_code: 'ABC12345',
        created_at: new Date(),
        updated_at: new Date()
      });

      const result = await createPaymentLink(mockData);

      expect(result.id).toBe('link-123');
      expect(result.status).toBe('DRAFT');
      expect(prismaMock.payment_links.create).toHaveBeenCalledTimes(1);
    });
  });
});
```

---

## 🐛 Troubleshooting

### Common Issues

#### Issue 1: Port 3000 Already in Use

```bash
# Error: Port 3000 is already in use

# Solution: Kill process on port 3000
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID [PID] /F

# Or use different port
PORT=3001 npm run dev
```

#### Issue 2: Database Connection Failed

```bash
# Error: Can't reach database server

# Check database URL
echo $DATABASE_URL

# Test connection
npx prisma db pull

# Verify Supabase project is running
# Dashboard → Project → Health

# Regenerate Prisma Client
npx prisma generate
```

#### Issue 3: Module Not Found

```bash
# Error: Cannot find module '@/...'

# Solution: Clear cache and reinstall
rm -rf node_modules .next
npm install
```

#### Issue 4: Prisma Client Not Generated

```bash
# Error: @prisma/client did not initialize yet

# Solution: Generate Prisma Client
npx prisma generate
```

#### Issue 5: Type Errors After Pull

```bash
# Error: Type 'X' is not assignable to type 'Y'

# Solution: Regenerate types
npm run db:generate
npx tsc --noEmit
```

#### Issue 6: Stripe Webhook Not Receiving Events

```bash
# Ensure Stripe CLI is running
npm run stripe:listen

# Check webhook secret in env.local matches CLI output
# Look for: "whsec_xxxxx" in CLI output

# Update env.local if needed
STRIPE_WEBHOOK_SECRET="whsec_xxxxx"

# Restart dev server
npm run dev
```

#### Issue 7: Redis Connection Failed

```bash
# Error: Redis connection timeout

# Test Redis connection
curl -X GET $UPSTASH_REDIS_REST_URL/ping \
  -H "Authorization: Bearer $UPSTASH_REDIS_REST_TOKEN"

# Expected: {"result":"PONG"}

# Check Upstash dashboard for database status
```

---

## 💻 IDE Configuration

### VS Code (Recommended)

#### Recommended Extensions

Install these extensions for the best development experience:

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",           // ESLint
    "esbenp.prettier-vscode",           // Prettier
    "bradlc.vscode-tailwindcss",        // Tailwind CSS IntelliSense
    "prisma.prisma",                    // Prisma
    "ms-vscode.vscode-typescript-next", // TypeScript
    "streetsidesoftware.code-spell-checker", // Spell checker
    "eamodio.gitlens"                   // GitLens
  ]
}
```

#### Workspace Settings

Create `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.associations": {
    "*.css": "tailwindcss"
  },
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ]
}
```

#### Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: debug server-side",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev"
    },
    {
      "name": "Next.js: debug client-side",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:3000"
    }
  ]
}
```

### WebStorm / IntelliJ IDEA

1. **Configure Node.js:**
   - Preferences → Languages & Frameworks → Node.js
   - Set Node interpreter

2. **Enable ESLint:**
   - Preferences → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
   - Enable "Automatic ESLint configuration"

3. **Configure Prettier:**
   - Preferences → Languages & Frameworks → JavaScript → Prettier
   - Enable "On save"

---

## 📂 Project Structure

```
provvypay/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/               # API routes
│   │   ├── (auth)/            # Auth pages
│   │   ├── (dashboard)/       # Dashboard pages
│   │   └── pay/               # Public payment pages
│   ├── components/            # React components
│   │   ├── ui/               # Base UI components
│   │   └── [feature]/        # Feature components
│   ├── lib/                   # Business logic
│   │   ├── db/               # Database utilities
│   │   ├── payment-link/     # Payment link service
│   │   ├── fx/               # FX snapshot service
│   │   ├── ledger/           # Ledger service
│   │   ├── xero/             # Xero integration
│   │   └── payments/         # Payment processing
│   ├── hooks/                 # Custom React hooks
│   ├── types/                 # TypeScript types
│   ├── prisma/               # Prisma schema & migrations
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── __tests__/            # Tests
│   ├── env.local             # Environment variables (local)
│   ├── next.config.ts        # Next.js config
│   ├── package.json          # Dependencies
│   └── tsconfig.json         # TypeScript config
└── docs/                      # Documentation
    ├── ARCHITECTURE.md
    ├── DATABASE_SCHEMA.md
    └── ...
```

---

## 🎯 Next Steps

After completing the setup:

1. **Explore the Codebase**
   - Read [ARCHITECTURE.md](./ARCHITECTURE.md)
   - Read [CODE_STYLE_GUIDE.md](./CODE_STYLE_GUIDE.md)

2. **Create a Payment Link**
   - Dashboard → Payment Links → Create
   - Test with Stripe test card: `4242 4242 4242 4242`

3. **Test Hedera Payment**
   - Create payment link
   - Use HashPack testnet wallet
   - Send testnet HBAR

4. **Explore Admin Panel**
   - Admin → Xero Sync Queue
   - Admin → Orphan Detection
   - Admin → System Health

5. **Read Contributing Guidelines**
   - [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## 🆘 Getting Help

- **Documentation:** [docs/](./docs/)
- **Issues:** [GitHub Issues](https://github.com/provvypay/provvypay/issues)
- **Discussions:** [GitHub Discussions](https://github.com/provvypay/provvypay/discussions)
- **Email:** engineering@provvypay.com

---

## 📖 Related Documentation

- [Architecture Overview](./ARCHITECTURE.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Contributing Guidelines](./CONTRIBUTING.md)
- [Code Style Guide](./CODE_STYLE_GUIDE.md)

---

**Last Updated:** December 16, 2025  
**Maintained By:** Provvypay Engineering Team  
**Happy Coding! 🚀**







