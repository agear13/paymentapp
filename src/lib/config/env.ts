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

  // Wise (optional – for payment link Wise rail)
  WISE_API_TOKEN: z.string().optional(),
  WISE_PROFILE_ID: z.string().optional(),
  WISE_WEBHOOK_SECRET: z.string().optional(),

  // Feature Flags
  ENABLE_HEDERA_PAYMENTS: z.string().optional().default('true'),
  ENABLE_HEDERA_STABLECOINS: z.string().optional().default('false'),
  ENABLE_XERO_SYNC: z.string().optional().default('true'),
  ENABLE_BETA_OPS: z.string().optional().default('false'),
  ENABLE_WISE_PAYMENTS: z.string().optional().default('false'),
  /** Show Wise as a payment option in UI for demo (even when backend not configured) */
  NEXT_PUBLIC_SHOW_WISE_DEMO: z.string().optional().default('true'),

  // Beta/Admin
  ADMIN_EMAIL_ALLOWLIST: z.string().optional(),
  
  // Sentry (optional)
  SENTRY_DSN: z.string().url().optional(),
});

// Parse and validate environment variables
function validateEnv() {
  // Skip validation during build time (Next.js build process)
  // Environment variables are only available at runtime on Render
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build' || 
                      process.env.NEXT_PHASE === 'phase-development-build' ||
                      process.env.npm_lifecycle_event === 'build';
  
  if (isBuildTime) {
    console.log('⏭️  Skipping environment validation during build time');
    // Return safe defaults for build time
    return {
      NODE_ENV: process.env.NODE_ENV || 'production',
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'https://example.com',
      DATABASE_URL: process.env.DATABASE_URL || 'postgresql://placeholder',
      DIRECT_URL: process.env.DIRECT_URL,
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key',
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key',
      STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder',
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder',
      STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder',
      NEXT_PUBLIC_HEDERA_NETWORK: (process.env.NEXT_PUBLIC_HEDERA_NETWORK as any) || 'mainnet',
      NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL: process.env.NEXT_PUBLIC_HEDERA_MIRROR_NODE_URL || 'https://mainnet.mirrornode.hedera.com',
      NEXT_PUBLIC_HEDERA_USDC_TOKEN_ID: process.env.NEXT_PUBLIC_HEDERA_USDC_TOKEN_ID,
      NEXT_PUBLIC_HEDERA_USDT_TOKEN_ID: process.env.NEXT_PUBLIC_HEDERA_USDT_TOKEN_ID,
      NEXT_PUBLIC_HEDERA_AUDD_TOKEN_ID: process.env.NEXT_PUBLIC_HEDERA_AUDD_TOKEN_ID,
      XERO_CLIENT_ID: process.env.XERO_CLIENT_ID,
      XERO_CLIENT_SECRET: process.env.XERO_CLIENT_SECRET,
      XERO_REDIRECT_URI: process.env.XERO_REDIRECT_URI,
      ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || 'placeholder-encryption-key-32chars',
      SESSION_SECRET: process.env.SESSION_SECRET,
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      ENABLE_HEDERA_PAYMENTS: process.env.ENABLE_HEDERA_PAYMENTS || 'true',
      ENABLE_HEDERA_STABLECOINS: process.env.ENABLE_HEDERA_STABLECOINS || 'false',
      ENABLE_XERO_SYNC: process.env.ENABLE_XERO_SYNC || 'true',
      ENABLE_BETA_OPS: process.env.ENABLE_BETA_OPS || 'false',
      ENABLE_WISE_PAYMENTS: process.env.ENABLE_WISE_PAYMENTS || 'false',
      NEXT_PUBLIC_SHOW_WISE_DEMO: process.env.NEXT_PUBLIC_SHOW_WISE_DEMO || 'true',
      WISE_API_TOKEN: process.env.WISE_API_TOKEN,
      WISE_PROFILE_ID: process.env.WISE_PROFILE_ID,
      WISE_WEBHOOK_SECRET: process.env.WISE_WEBHOOK_SECRET,
      ADMIN_EMAIL_ALLOWLIST: process.env.ADMIN_EMAIL_ALLOWLIST,
      SENTRY_DSN: process.env.SENTRY_DSN,
    };
  }
  
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Invalid environment variables:');
      if (error.errors && Array.isArray(error.errors)) {
        error.errors.forEach((err) => {
          console.error(`  - ${err.path.join('.')}: ${err.message}`);
        });
      }
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
  isBeta: env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || 
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
    isTestMode: env.STRIPE_SECRET_KEY?.startsWith('sk_test_') || false,
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
  
  // Wise
  wise: {
    apiToken: env.WISE_API_TOKEN,
    profileId: env.WISE_PROFILE_ID,
    webhookSecret: env.WISE_WEBHOOK_SECRET,
    isConfigured: !!(env.WISE_API_TOKEN && env.WISE_PROFILE_ID),
  },

  // Feature Flags
  features: {
    hederaPayments: env.ENABLE_HEDERA_PAYMENTS === 'true',
    hederaStablecoins: env.ENABLE_HEDERA_STABLECOINS === 'true',
    xeroSync: env.ENABLE_XERO_SYNC === 'true' && !!(env.XERO_CLIENT_ID && env.XERO_CLIENT_SECRET),
    betaOps: env.ENABLE_BETA_OPS === 'true',
    // Wise: enabled when ENABLE_WISE_PAYMENTS is "true" or "1" (case-insensitive) AND API token present
    // Note: WISE_PROFILE_ID is now optional globally; prefer per-merchant wise_profile_id
    wisePayments: ['true', '1'].includes((env.ENABLE_WISE_PAYMENTS || '').toLowerCase()) && !!env.WISE_API_TOKEN,
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
  // DEV-ONLY: Wise config debugging (no secrets)
  console.log('  Wise config:');
  console.log('    ENABLE_WISE_PAYMENTS:', env.ENABLE_WISE_PAYMENTS);
  console.log('    wisePayments (computed):', config.features.wisePayments);
  console.log('    WISE_API_TOKEN present:', !!env.WISE_API_TOKEN);
  console.log('    WISE_PROFILE_ID present:', !!env.WISE_PROFILE_ID);
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

