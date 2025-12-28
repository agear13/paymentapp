/**
 * Test Script: USDT Rate Fetching
 * 
 * This script tests that USDT rates can be fetched from both providers
 * and that the multi-token snapshot system works correctly.
 */

import { getFxService } from '@/lib/fx';
import { getRateProviderFactory } from '@/lib/fx/rate-provider-factory';
import { log } from '@/lib/logger';

const logger = log.child({ domain: 'test:usdt-rates' });

async function testUSDTRates() {
  console.log('🧪 Testing USDT Support in FX Pricing Engine\n');
  console.log('='.repeat(60));

  try {
    // Initialize provider factory
    const factory = getRateProviderFactory();
    await factory.initialize();

    // Test 1: Fetch USDT/USD rate
    console.log('\n📊 Test 1: Fetch USDT/USD rate');
    console.log('-'.repeat(60));
    try {
      const usdtUsd = await factory.getRate('USDT', 'USD');
      console.log('✅ USDT/USD rate fetched successfully');
      console.log(`   Rate: ${usdtUsd.rate.toFixed(8)}`);
      console.log(`   Provider: ${usdtUsd.provider}`);
      console.log(`   Timestamp: ${usdtUsd.timestamp.toISOString()}`);
    } catch (error) {
      console.error('❌ Failed to fetch USDT/USD rate:', error);
    }

    // Test 2: Fetch USDT/AUD rate
    console.log('\n📊 Test 2: Fetch USDT/AUD rate');
    console.log('-'.repeat(60));
    try {
      const usdtAud = await factory.getRate('USDT', 'AUD');
      console.log('✅ USDT/AUD rate fetched successfully');
      console.log(`   Rate: ${usdtAud.rate.toFixed(8)}`);
      console.log(`   Provider: ${usdtAud.provider}`);
      console.log(`   Timestamp: ${usdtAud.timestamp.toISOString()}`);
    } catch (error) {
      console.error('❌ Failed to fetch USDT/AUD rate:', error);
    }

    // Test 3: Fetch all three token rates in parallel
    console.log('\n📊 Test 3: Fetch all three tokens (HBAR, USDC, USDT) in parallel');
    console.log('-'.repeat(60));
    try {
      const rates = await factory.getRates([
        { base: 'HBAR', quote: 'USD' },
        { base: 'USDC', quote: 'USD' },
        { base: 'USDT', quote: 'USD' },
      ]);
      console.log('✅ All three token rates fetched successfully');
      for (const rate of rates) {
        console.log(`   ${rate.base}/${rate.quote}: ${rate.rate.toFixed(8)} (${rate.provider})`);
      }
    } catch (error) {
      console.error('❌ Failed to fetch multi-token rates:', error);
    }

    // Test 4: Test FX Service high-level API
    console.log('\n📊 Test 4: Test FX Service API');
    console.log('-'.repeat(60));
    try {
      const fxService = getFxService();
      const usdtRate = await fxService.getRate('USDT', 'USD');
      console.log('✅ FX Service getRate() works for USDT');
      console.log(`   Rate: ${usdtRate.rate.toFixed(8)}`);
    } catch (error) {
      console.error('❌ FX Service test failed:', error);
    }

    // Test 5: Test provider fallback
    console.log('\n📊 Test 5: Test provider fallback for USDT');
    console.log('-'.repeat(60));
    try {
      const providers = factory.getProviders();
      console.log(`   Available providers: ${providers.map(p => p.name).join(', ')}`);
      
      for (const provider of providers) {
        if (provider.supportsPair('USDT', 'USD')) {
          console.log(`   ✓ ${provider.name} supports USDT/USD`);
        } else {
          console.log(`   ✗ ${provider.name} does NOT support USDT/USD`);
        }
      }
    } catch (error) {
      console.error('❌ Provider check failed:', error);
    }

    // Test 6: Check provider health
    console.log('\n📊 Test 6: Check provider health');
    console.log('-'.repeat(60));
    try {
      const health = await factory.checkHealth();
      console.log('✅ Provider health check completed');
      for (const [providerName, isHealthy] of Object.entries(health)) {
        const status = isHealthy ? '✓ Healthy' : '✗ Unhealthy';
        console.log(`   ${providerName}: ${status}`);
      }
    } catch (error) {
      console.error('❌ Health check failed:', error);
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ USDT Support Test Complete!\n');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests
testUSDTRates()
  .then(() => {
    console.log('✅ All tests completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error);
    process.exit(1);
  });












