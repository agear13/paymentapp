/**
 * Authentication Error Handling
 * Custom error classes for authentication and authorization
 */

export type AuthErrorCode =
  | 'UNAUTHENTICATED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'INVALID_CREDENTIALS'
  | 'SESSION_EXPIRED'
  | 'EMAIL_NOT_CONFIRMED'
  | 'ACCOUNT_DISABLED'
  | 'RATE_LIMITED'
  | 'INVALID_TOKEN'
  | 'TOKEN_EXPIRED'

export class AuthError extends Error {
  code: AuthErrorCode
  statusCode: number
  details?: any

  constructor(message: string, code: AuthErrorCode, details?: any) {
    super(message)
    this.name = 'AuthError'
    this.code = code
    this.details = details
    this.statusCode = this.getStatusCode(code)
  }

  private getStatusCode(code: AuthErrorCode): number {
    const statusCodes: Record<AuthErrorCode, number> = {
      UNAUTHENTICATED: 401,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      INVALID_CREDENTIALS: 401,
      SESSION_EXPIRED: 401,
      EMAIL_NOT_CONFIRMED: 403,
      ACCOUNT_DISABLED: 403,
      RATE_LIMITED: 429,
      INVALID_TOKEN: 401,
      TOKEN_EXPIRED: 401,
    }

    return statusCodes[code] || 500
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    }
  }
}

/**
 * Error messages for different auth error types
 */
export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  UNAUTHENTICATED: 'You must be logged in to access this resource',
  UNAUTHORIZED: 'You are not authorized to perform this action',
  FORBIDDEN: 'Access to this resource is forbidden',
  INVALID_CREDENTIALS: 'Invalid email or password',
  SESSION_EXPIRED: 'Your session has expired. Please log in again',
  EMAIL_NOT_CONFIRMED: 'Please confirm your email address to continue',
  ACCOUNT_DISABLED: 'Your account has been disabled',
  RATE_LIMITED: 'Too many requests. Please try again later',
  INVALID_TOKEN: 'Invalid authentication token',
  TOKEN_EXPIRED: 'Authentication token has expired',
}

/**
 * Handle Supabase auth errors and convert to AuthError
 */
export function handleSupabaseAuthError(error: any): AuthError {
  // Map Supabase error messages to our error codes
  const errorMessage = error?.message?.toLowerCase() || ''

  if (errorMessage.includes('invalid login credentials')) {
    return new AuthError(
      AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS,
      'INVALID_CREDENTIALS'
    )
  }

  if (errorMessage.includes('email not confirmed')) {
    return new AuthError(
      AUTH_ERROR_MESSAGES.EMAIL_NOT_CONFIRMED,
      'EMAIL_NOT_CONFIRMED'
    )
  }

  if (errorMessage.includes('session expired')) {
    return new AuthError(
      AUTH_ERROR_MESSAGES.SESSION_EXPIRED,
      'SESSION_EXPIRED'
    )
  }

  if (errorMessage.includes('jwt expired')) {
    return new AuthError(
      AUTH_ERROR_MESSAGES.TOKEN_EXPIRED,
      'TOKEN_EXPIRED'
    )
  }

  if (errorMessage.includes('rate limit')) {
    return new AuthError(
      AUTH_ERROR_MESSAGES.RATE_LIMITED,
      'RATE_LIMITED'
    )
  }

  // Default to unauthenticated error
  return new AuthError(
    error?.message || AUTH_ERROR_MESSAGES.UNAUTHENTICATED,
    'UNAUTHENTICATED',
    error
  )
}

/**
 * Check if error is an auth error
 */
export function isAuthError(error: any): error is AuthError {
  return error instanceof AuthError
}













