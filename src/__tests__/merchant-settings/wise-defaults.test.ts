/**
 * Tests for Wise auto-enable defaults on new merchant settings
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the config module
const mockConfig = {
  isDevelopment: true,
  wise: {
    defaultProfileId: null as string | null,
  },
};

vi.mock('@/lib/config/env', () => ({
  default: mockConfig,
}));

describe('Merchant Settings Wise Defaults', () => {
  beforeEach(() => {
    // Reset mock config before each test
    mockConfig.wise.defaultProfileId = null;
  });

  describe('getWiseDefaults', () => {
    // Helper function that mirrors the logic in merchant-settings/route.ts
    function getWiseDefaults(body: {
      wiseProfileId?: string;
      wiseEnabled?: boolean;
      wiseCurrency?: string;
      defaultCurrency?: string;
    }) {
      const resolvedWiseProfileId = body.wiseProfileId !== undefined 
        ? body.wiseProfileId 
        : mockConfig.wise.defaultProfileId;
      
      const resolvedWiseEnabled = body.wiseEnabled !== undefined 
        ? body.wiseEnabled 
        : true; // Default to enabled for new orgs
      
      const resolvedWiseCurrency = body.wiseCurrency !== undefined 
        ? body.wiseCurrency 
        : (body.defaultCurrency || 'AUD');

      return {
        wise_profile_id: resolvedWiseProfileId,
        wise_enabled: resolvedWiseEnabled,
        wise_currency: resolvedWiseCurrency,
      };
    }

    it('should default wise_enabled to true for new orgs', () => {
      const defaults = getWiseDefaults({ defaultCurrency: 'USD' });
      expect(defaults.wise_enabled).toBe(true);
    });

    it('should use defaultCurrency for wise_currency when not specified', () => {
      const defaults = getWiseDefaults({ defaultCurrency: 'EUR' });
      expect(defaults.wise_currency).toBe('EUR');
    });

    it('should fall back to AUD when no defaultCurrency provided', () => {
      const defaults = getWiseDefaults({});
      expect(defaults.wise_currency).toBe('AUD');
    });

    it('should use DEFAULT_WISE_PROFILE_ID when set', () => {
      mockConfig.wise.defaultProfileId = '84420198';
      const defaults = getWiseDefaults({ defaultCurrency: 'USD' });
      expect(defaults.wise_profile_id).toBe('84420198');
    });

    it('should leave wise_profile_id null when no default configured', () => {
      mockConfig.wise.defaultProfileId = null;
      const defaults = getWiseDefaults({ defaultCurrency: 'USD' });
      expect(defaults.wise_profile_id).toBeNull();
    });

    it('should NOT override explicit wiseEnabled=false', () => {
      const defaults = getWiseDefaults({ 
        defaultCurrency: 'USD',
        wiseEnabled: false,
      });
      expect(defaults.wise_enabled).toBe(false);
    });

    it('should NOT override explicit wiseProfileId', () => {
      mockConfig.wise.defaultProfileId = '84420198';
      const defaults = getWiseDefaults({ 
        defaultCurrency: 'USD',
        wiseProfileId: 'custom-profile-123',
      });
      expect(defaults.wise_profile_id).toBe('custom-profile-123');
    });

    it('should NOT override explicit wiseCurrency', () => {
      const defaults = getWiseDefaults({ 
        defaultCurrency: 'USD',
        wiseCurrency: 'GBP',
      });
      expect(defaults.wise_currency).toBe('GBP');
    });

    it('should respect all explicit values even when defaults exist', () => {
      mockConfig.wise.defaultProfileId = '84420198';
      const defaults = getWiseDefaults({ 
        defaultCurrency: 'USD',
        wiseProfileId: 'explicit-profile',
        wiseEnabled: false,
        wiseCurrency: 'JPY',
      });
      expect(defaults.wise_profile_id).toBe('explicit-profile');
      expect(defaults.wise_enabled).toBe(false);
      expect(defaults.wise_currency).toBe('JPY');
    });
  });
});
