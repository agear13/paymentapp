/**
 * Environment Configuration with Validation
 * Validates all required environment variables and exposes typed config
 */

import { z } from 'zod';

// Environment variable schema
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Application
  NEXT_PUBLIC_APP_URL: z.string().url(),
  
  // Database
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1),
  STRIPE_WEBHOOK_SECRET: z.string().min(1),

  // Hedera
  NEXT_PUBLIC_HEDERA_NETWORK: z.enum(['mainnet', 'testnet', 'previewnet']).default('mainnet'),
  NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL: z.string().url(),
  NEXT_PUBLIC_HEDERA_USDC_TOKEN_ID: z.string().optional(),
  NEXT_PUBLIC_HEDERA_USDT_TOKEN_ID: z.string().optional(),
  NEXT_PUBLIC_HEDERA_AUDD_TOKEN_ID: z.string().optional(),

  // Xero (optional)
  XERO_CLIENT_ID: z.string().optional(),
  XERO_CLIENT_SECRET: z.string().optional(),
  XERO_REDIRECT_URI: z.string().url().optional(),

  // Encryption
  ENCRYPTION_KEY: z.string().min(1),
  SESSION_SECRET: z.string().optional(),

  // Redis (optional)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // Email (optional)
  RESEND_API_KEY: z.string().optional(),

  // Feature Flags
  ENABLE_HEDERA_PAYMENTS: z.string().optional().default('true'),
  ENABLE_HEDERA_STABLECOINS: z.string().optional().default('false'),
  ENABLE_XERO_SYNC: z.string().optional().default('true'),
  ENABLE_BETA_OPS: z.string().optional().default('false'),

  // Beta/Admin
  ADMIN_EMAIL_ALLOWLIST: z.string().optional(),
  
  // Sentry (optional)
  SENTRY_DSN: z.string().url().optional(),
});

// Parse and validate environment variables
function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      error.errors.forEach((err) => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      throw new Error('Environment validation failed');
    }
    throw error;
  }
}

// Validated environment variables
const env = validateEnv();

// Derived configuration
export const config = {
  // Environment
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  
  // Beta detection
  isBeta: env.STRIPE_SECRET_KEY.startsWith('sk_test_') || 
          env.NEXT_PUBLIC_HEDERA_NETWORK === 'testnet',
  
  // Application
  appUrl: env.NEXT_PUBLIC_APP_URL,
  
  // Database
  databaseUrl: env.DATABASE_URL,
  directUrl: env.DIRECT_URL,
  
  // Supabase
  supabase: {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  },
  
  // Stripe
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    publishableKey: env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    isTestMode: env.STRIPE_SECRET_KEY.startsWith('sk_test_'),
  },
  
  // Hedera
  hedera: {
    network: env.NEXT_PUBLIC_HEDERA_NETWORK,
    mirrorNodeUrl: env.NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL,
    isTestnet: env.NEXT_PUBLIC_HEDERA_NETWORK === 'testnet',
    tokens: {
      usdc: env.NEXT_PUBLIC_HEDERA_USDC_TOKEN_ID,
      usdt: env.NEXT_PUBLIC_HEDERA_USDT_TOKEN_ID,
      audd: env.NEXT_PUBLIC_HEDERA_AUDD_TOKEN_ID,
    },
  },
  
  // Xero
  xero: {
    clientId: env.XERO_CLIENT_ID,
    clientSecret: env.XERO_CLIENT_SECRET,
    redirectUri: env.XERO_REDIRECT_URI,
    isConfigured: !!(env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET),
  },
  
  // Security
  encryptionKey: env.ENCRYPTION_KEY,
  sessionSecret: env.SESSION_SECRET,
  
  // Redis
  redis: {
    url: env.UPSTASH_REDIS_REST_URL,
    token: env.UPSTASH_REDIS_REST_TOKEN,
    isConfigured: !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
  },
  
  // Email
  email: {
    apiKey: env.RESEND_API_KEY,
    isConfigured: !!env.RESEND_API_KEY,
  },
  
  // Feature Flags
  features: {
    hederaPayments: env.ENABLE_HEDERA_PAYMENTS === 'true',
    hederaStablecoins: env.ENABLE_HEDERA_STABLECOINS === 'true',
    xeroSync: env.ENABLE_XERO_SYNC === 'true' && !!(env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET),
    betaOps: env.ENABLE_BETA_OPS === 'true',
  },
  
  // Admin
  admin: {
    emailAllowlist: env.ADMIN_EMAIL_ALLOWLIST?.split(',').map(e => e.trim()) || [],
  },
  
  // Monitoring
  sentry: {
    dsn: env.SENTRY_DSN,
    isConfigured: !!env.SENTRY_DSN,
  },
} as const;

// Export for use throughout the application
export { env };

// Helper to check if user is admin
export function isAdminEmail(email: string): boolean {
  if (config.admin.emailAllowlist.length === 0) {
    return false;
  }
  return config.admin.emailAllowlist.includes(email.toLowerCase());
}

// Log configuration on startup (but hide secrets)
if (config.isDevelopment) {
  console.log('🔧 Configuration loaded:');
  console.log('  Environment:', env.NODE_ENV);
  console.log('  Beta Mode:', config.isBeta);
  console.log('  Stripe Test Mode:', config.stripe.isTestMode);
  console.log('  Hedera Network:', config.hedera.network);
  console.log('  Features:', config.features);
}

// Validate beta environment consistency
if (config.isBeta) {
  console.log('🧪 BETA MODE ACTIVE');
  
  // Ensure Stripe is in test mode
  if (!config.stripe.isTestMode) {
    console.warn('⚠️  WARNING: Beta mode detected but Stripe is not in test mode!');
  }
  
  // Ensure Hedera is testnet
  if (!config.hedera.isTestnet) {
    console.warn('⚠️  WARNING: Beta mode detected but Hedera is not on testnet!');
  }
}

export default config;

