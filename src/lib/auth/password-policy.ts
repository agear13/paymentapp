/** Minimum password length for production auth flows. */
export const MIN_PASSWORD_LENGTH = 12;

/** Top common passwords rejected at registration and password change. */
const COMMON_PASSWORDS = new Set([
  'password1234',
  'password12345',
  'password123456',
  'qwertyuiop12',
  '123456789012',
  'welcome12345',
  'letmein12345',
  'admin1234567',
  'changeme1234',
  'iloveyou1234',
  'sunshine1234',
  'football1234',
  'baseball1234',
  'monkey123456',
  'dragon123456',
  'master123456',
  'trustno112345',
  'superman1234',
  'batman123456',
  'passw0rd12345',
  'provvypay1234',
]);

export type PasswordValidationResult =
  | { valid: true }
  | { valid: false; message: string };

export function validatePassword(password: string, email?: string): PasswordValidationResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const normalized = password.trim().toLowerCase();
  if (COMMON_PASSWORDS.has(normalized)) {
    return {
      valid: false,
      message: 'This password is too common. Please choose a stronger password.',
    };
  }

  if (email) {
    const localPart = email.split('@')[0]?.toLowerCase();
    if (localPart && localPart.length >= 4 && normalized.includes(localPart)) {
      return {
        valid: false,
        message: 'Password must not contain your email address.',
      };
    }
  }

  return { valid: true };
}
