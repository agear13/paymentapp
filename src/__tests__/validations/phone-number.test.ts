import {
  normalizePhoneToE164,
  stripPhoneFormatting,
  PHONE_VALIDATION_MESSAGE,
} from '@/lib/validations/phone-number';

describe('normalizePhoneToE164', () => {
  it.each([
    ['0412345678', '+61412345678'],
    ['0412 345 678', '+61412345678'],
    ['04 1234 5678', '+61412345678'],
    ['+61 412 345 678', '+61412345678'],
    ['+61412345678', '+61412345678'],
    ['61412345678', '+61412345678'],
    ['(04) 1234 5678', '+61412345678'],
    ['02 1234 5678', '+61212345678'],
  ])('normalizes %s → %s', (input, expected) => {
    expect(normalizePhoneToE164(input)).toBe(expected);
  });

  it('preserves non-Australian valid E.164 numbers', () => {
    expect(normalizePhoneToE164('+14155552671')).toBe('+14155552671');
    expect(normalizePhoneToE164('+442071234567')).toBe('+442071234567');
  });

  it.each([
    '',
    '   ',
    '12345',
    '412345678',
    '041234567',
    '041234567890',
    '0112345678',
    'not-a-phone',
    '+0412345678',
    '++61412345678',
  ])('rejects invalid input: %s', (input) => {
    expect(normalizePhoneToE164(input)).toBeNull();
  });

  it('does not include raw input in normalized output checks', () => {
    const result = normalizePhoneToE164('0412 345 678');
    expect(result).toBe('+61412345678');
    expect(result).not.toContain(' ');
  });
});

describe('stripPhoneFormatting', () => {
  it('removes spaces, dashes, and parentheses', () => {
    expect(stripPhoneFormatting('+61 412-345 (678)')).toBe('+61412345678');
  });
});

describe('PHONE_VALIDATION_MESSAGE', () => {
  it('mentions Australian example formats', () => {
    expect(PHONE_VALIDATION_MESSAGE).toMatch(/0412 345 678/);
    expect(PHONE_VALIDATION_MESSAGE).toMatch(/\+61412345678/);
  });
});
