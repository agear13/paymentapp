/**
 * Timezone Utilities
 * 
 * Handle timezone edge cases for:
 * - Payment link expiry calculations
 * - Reporting date ranges
 * - Audit log timestamps
 * - Cross-timezone consistency
 * 
 * Sprint 24: Robust timezone handling
 */

import { log } from '@/lib/logger';

// ============================================================================
// Type Definitions
// ============================================================================

export interface TimezoneConfig {
  timezone: string; // IANA timezone (e.g., 'America/New_York')
  offsetMinutes: number;
  isDST: boolean;
}

export interface DateRange {
  start: Date;
  end: Date;
  timezone?: string;
}

// ============================================================================
// Timezone Detection
// ============================================================================

/**
 * Get user's timezone from browser or default to UTC
 */
export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch (error) {
    log.warn({ error }, 'Failed to get user timezone, defaulting to UTC');
    return 'UTC';
  }
}

/**
 * Get timezone offset in minutes
 */
export function getTimezoneOffset(timezone: string, date: Date = new Date()): number {
  try {
    // Create formatters for UTC and target timezone
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    
    // Calculate offset in minutes
    const offsetMs = tzDate.getTime() - utcDate.getTime();
    return Math.round(offsetMs / (1000 * 60));
  } catch (error) {
    log.warn({ error, timezone }, 'Failed to get timezone offset');
    return 0;
  }
}

/**
 * Check if date is in DST for given timezone
 */
export function isDaylightSavingTime(timezone: string, date: Date = new Date()): boolean {
  try {
    const jan = new Date(date.getFullYear(), 0, 1);
    const jul = new Date(date.getFullYear(), 6, 1);
    
    const janOffset = getTimezoneOffset(timezone, jan);
    const julOffset = getTimezoneOffset(timezone, jul);
    const currentOffset = getTimezoneOffset(timezone, date);
    
    // DST is active if current offset is greater than standard offset
    const stdOffset = Math.max(janOffset, julOffset);
    return currentOffset < stdOffset;
  } catch (error) {
    log.warn({ error, timezone }, 'Failed to detect DST');
    return false;
  }
}

// ============================================================================
// Expiry Calculations
// ============================================================================

/**
 * Calculate expiry date with timezone awareness
 * 
 * Ensures expiry is calculated correctly across DST boundaries
 */
export function calculateExpiryDate(
  fromDate: Date,
  hours: number,
  timezone: string = 'UTC'
): Date {
  try {
    // Create expiry date in UTC
    const expiryDate = new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
    
    // Check if we crossed a DST boundary
    const fromDST = isDaylightSavingTime(timezone, fromDate);
    const toDST = isDaylightSavingTime(timezone, expiryDate);
    
    if (fromDST !== toDST) {
      // DST transition occurred - adjust by 1 hour
      const adjustment = fromDST ? 1 : -1; // Spring forward, fall back
      log.info(
        {
          fromDate,
          expiryDate,
          timezone,
          fromDST,
          toDST,
          adjustment,
        },
        'DST boundary crossed during expiry calculation'
      );
      
      return new Date(expiryDate.getTime() + adjustment * 60 * 60 * 1000);
    }
    
    return expiryDate;
  } catch (error) {
    log.error({ error, fromDate, hours, timezone }, 'Failed to calculate expiry date');
    // Fallback to simple calculation
    return new Date(fromDate.getTime() + hours * 60 * 60 * 1000);
  }
}

/**
 * Check if payment link is expired (with timezone consideration)
 */
export function isExpired(
  expiryDate: Date | null,
  now: Date = new Date(),
  gracePeriodMinutes: number = 0
): boolean {
  if (!expiryDate) {
    return false; // No expiry set
  }

  // Add grace period for timezone-related timing issues
  const effectiveExpiryDate = new Date(
    expiryDate.getTime() + gracePeriodMinutes * 60 * 1000
  );

  return now > effectiveExpiryDate;
}

// ============================================================================
// Date Range Handling
// ============================================================================

/**
 * Create date range for reporting with timezone awareness
 * 
 * Ensures the range covers full days in the user's timezone
 */
export function createDateRange(
  startDate: Date,
  endDate: Date,
  timezone: string = 'UTC'
): DateRange {
  try {
    // Convert to start of day in user's timezone
    const startOfDay = new Date(
      startDate.toLocaleString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
    startOfDay.setHours(0, 0, 0, 0);

    // Convert to end of day in user's timezone
    const endOfDay = new Date(
      endDate.toLocaleString('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
    endOfDay.setHours(23, 59, 59, 999);

    return {
      start: startOfDay,
      end: endOfDay,
      timezone,
    };
  } catch (error) {
    log.error({ error, startDate, endDate, timezone }, 'Failed to create date range');
    // Fallback to simple range
    return {
      start: startDate,
      end: endDate,
      timezone: 'UTC',
    };
  }
}

/**
 * Get start of day in specific timezone
 */
export function getStartOfDay(date: Date, timezone: string = 'UTC'): Date {
  try {
    const dateString = date.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    const startOfDay = new Date(dateString);
    startOfDay.setHours(0, 0, 0, 0);
    
    return startOfDay;
  } catch (error) {
    log.error({ error, date, timezone }, 'Failed to get start of day');
    const fallback = new Date(date);
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
}

/**
 * Get end of day in specific timezone
 */
export function getEndOfDay(date: Date, timezone: string = 'UTC'): Date {
  try {
    const dateString = date.toLocaleString('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    
    const endOfDay = new Date(dateString);
    endOfDay.setHours(23, 59, 59, 999);
    
    return endOfDay;
  } catch (error) {
    log.error({ error, date, timezone }, 'Failed to get end of day');
    const fallback = new Date(date);
    fallback.setHours(23, 59, 59, 999);
    return fallback;
  }
}

// ============================================================================
// Timestamp Formatting
// ============================================================================

/**
 * Format timestamp for display in user's timezone
 */
export function formatTimestamp(
  date: Date,
  timezone: string = 'UTC',
  options: Intl.DateTimeFormatOptions = {}
): string {
  try {
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: timezone,
      timeZoneName: 'short',
    };

    return date.toLocaleString('en-US', { ...defaultOptions, ...options });
  } catch (error) {
    log.error({ error, date, timezone }, 'Failed to format timestamp');
    return date.toISOString();
  }
}

/**
 * Format date for SQL queries (always UTC)
 */
export function formatSQLDate(date: Date): string {
  return date.toISOString();
}

/**
 * Parse date string with timezone
 */
export function parseDate(
  dateString: string,
  timezone: string = 'UTC'
): Date | null {
  try {
    const date = new Date(dateString);
    
    if (isNaN(date.getTime())) {
      log.warn({ dateString }, 'Invalid date string');
      return null;
    }
    
    return date;
  } catch (error) {
    log.error({ error, dateString }, 'Failed to parse date');
    return null;
  }
}

// ============================================================================
// Relative Time
// ============================================================================

/**
 * Get relative time description (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date, now: Date = new Date()): string {
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) {
    return 'just now';
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} day${days === 1 ? '' : 's'} ago`;
  }
  
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `${months} month${months === 1 ? '' : 's'} ago`;
  }
  
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? '' : 's'} ago`;
}

/**
 * Get time until expiry description
 */
export function getTimeUntilExpiry(expiryDate: Date, now: Date = new Date()): string {
  const seconds = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
  
  if (seconds < 0) {
    return 'expired';
  }
  
  if (seconds < 60) {
    return 'less than 1 minute';
  }
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate timezone string
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get safe timezone (validates and falls back to UTC)
 */
export function getSafeTimezone(timezone?: string): string {
  if (!timezone) {
    return 'UTC';
  }
  
  if (isValidTimezone(timezone)) {
    return timezone;
  }
  
  log.warn({ timezone }, 'Invalid timezone, falling back to UTC');
  return 'UTC';
}

// ============================================================================
// Midnight Calculations (for EOD processing)
// ============================================================================

/**
 * Get next midnight in specific timezone
 * Useful for scheduling EOD processes
 */
export function getNextMidnight(timezone: string = 'UTC', from: Date = new Date()): Date {
  const tomorrow = new Date(from);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return getStartOfDay(tomorrow, timezone);
}

/**
 * Get previous midnight in specific timezone
 */
export function getPreviousMidnight(timezone: string = 'UTC', from: Date = new Date()): Date {
  return getStartOfDay(from, timezone);
}

/**
 * Check if time is near midnight (within 5 minutes)
 * Useful for avoiding race conditions in EOD processing
 */
export function isNearMidnight(date: Date, timezone: string = 'UTC', thresholdMinutes: number = 5): boolean {
  const midnight = getNextMidnight(timezone, date);
  const msUntilMidnight = midnight.getTime() - date.getTime();
  const minutesUntilMidnight = msUntilMidnight / (1000 * 60);
  
  return minutesUntilMidnight >= 0 && minutesUntilMidnight <= thresholdMinutes;
}







