/**
 * Validation Middleware for API Routes
 * Provides request validation and error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

/**
 * Validates request body against a Zod schema
 */
export const validateRequestBody = async <T>(
  request: NextRequest,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> => {
  try {
    const body = await request.json();
    const validatedData = schema.parse(body);
    
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: ValidationError[] = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      
      logger.warn('Request body validation failed', { errors });
      
      return {
        success: false,
        errors,
      };
    }
    
    // Handle JSON parse errors
    logger.error('Failed to parse request body', { error });
    
    return {
      success: false,
      errors: [{ field: 'body', message: 'Invalid JSON in request body' }],
    };
  }
};

/**
 * Validates query parameters against a Zod schema
 */
export const validateQueryParams = <T>(
  request: NextRequest,
  schema: ZodSchema<T>
): ValidationResult<T> => {
  try {
    const { searchParams } = new URL(request.url);
    const params: Record<string, string> = {};
    
    searchParams.forEach((value, key) => {
      params[key] = value;
    });
    
    const validatedData = schema.parse(params);
    
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: ValidationError[] = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      
      logger.warn('Query parameters validation failed', { errors });
      
      return {
        success: false,
        errors,
      };
    }
    
    logger.error('Failed to validate query parameters', { error });
    
    return {
      success: false,
      errors: [{ field: 'query', message: 'Invalid query parameters' }],
    };
  }
};

/**
 * Validates path parameters against a Zod schema
 */
export const validatePathParams = <T>(
  params: Record<string, string | string[]>,
  schema: ZodSchema<T>
): ValidationResult<T> => {
  try {
    const validatedData = schema.parse(params);
    
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: ValidationError[] = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      
      logger.warn('Path parameters validation failed', { errors });
      
      return {
        success: false,
        errors,
      };
    }
    
    logger.error('Failed to validate path parameters', { error });
    
    return {
      success: false,
      errors: [{ field: 'params', message: 'Invalid path parameters' }],
    };
  }
};

/**
 * Creates a validation error response
 */
export const createValidationErrorResponse = (
  errors: ValidationError[]
): NextResponse => {
  return NextResponse.json(
    {
      error: 'Validation failed',
      details: errors,
    },
    { status: 400 }
  );
};

// ============================================================================
// HIGHER-ORDER FUNCTION FOR ROUTE HANDLERS
// ============================================================================

export interface ValidatedRouteContext<TBody = unknown, TQuery = unknown, TParams = unknown> {
  body?: TBody;
  query?: TQuery;
  params?: TParams;
  request: NextRequest;
}

export type ValidatedRouteHandler<TBody = unknown, TQuery = unknown, TParams = unknown> = (
  context: ValidatedRouteContext<TBody, TQuery, TParams>
) => Promise<NextResponse>;

export interface ValidationSchemas<TBody = unknown, TQuery = unknown, TParams = unknown> {
  body?: ZodSchema<TBody>;
  query?: ZodSchema<TQuery>;
  params?: ZodSchema<TParams>;
}

/**
 * Wraps a route handler with validation
 * 
 * @example
 * ```typescript
 * export const POST = withValidation(
 *   {
 *     body: CreatePaymentLinkSchema,
 *     query: PaginationSchema,
 *   },
 *   async ({ body, query, request }) => {
 *     // body and query are typed and validated
 *     const paymentLink = await createPaymentLink(body);
 *     return NextResponse.json(paymentLink);
 *   }
 * );
 * ```
 */
export const withValidation = <TBody = unknown, TQuery = unknown, TParams = unknown>(
  schemas: ValidationSchemas<TBody, TQuery, TParams>,
  handler: ValidatedRouteHandler<TBody, TQuery, TParams>
) => {
  return async (
    request: NextRequest,
    context?: { params?: Promise<Record<string, string | string[]>> }
  ): Promise<NextResponse> => {
    const validatedContext: ValidatedRouteContext<TBody, TQuery, TParams> = {
      request,
    };
    
    // Validate request body
    if (schemas.body) {
      const bodyResult = await validateRequestBody(request, schemas.body);
      
      if (!bodyResult.success) {
        return createValidationErrorResponse(bodyResult.errors!);
      }
      
      validatedContext.body = bodyResult.data;
    }
    
    // Validate query parameters
    if (schemas.query) {
      const queryResult = validateQueryParams(request, schemas.query);
      
      if (!queryResult.success) {
        return createValidationErrorResponse(queryResult.errors!);
      }
      
      validatedContext.query = queryResult.data;
    }
    
    // Validate path parameters
    if (schemas.params && context?.params) {
      const resolvedParams = await context.params;
      const paramsResult = validatePathParams(resolvedParams, schemas.params);
      
      if (!paramsResult.success) {
        return createValidationErrorResponse(paramsResult.errors!);
      }
      
      validatedContext.params = paramsResult.data;
    }
    
    // Call the handler with validated data
    try {
      return await handler(validatedContext);
    } catch (error) {
      logger.error('Route handler error', { error });
      
      return NextResponse.json(
        {
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
  };
};

// ============================================================================
// SAFE PARSE UTILITIES
// ============================================================================

/**
 * Safely parses data with a Zod schema without throwing
 */
export const safeParse = <T>(
  data: unknown,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; errors: ValidationError[] } => {
  try {
    const validatedData = schema.parse(data);
    return { success: true, data: validatedData };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: ValidationError[] = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      
      return { success: false, errors };
    }
    
    return {
      success: false,
      errors: [{ field: 'unknown', message: 'Validation failed' }],
    };
  }
};

/**
 * Validates partial data (useful for PATCH requests)
 */
export const validatePartial = <T>(
  data: unknown,
  schema: ZodSchema<T>
): ValidationResult<Partial<T>> => {
  try {
    const partialSchema = schema.partial();
    const validatedData = partialSchema.parse(data);
    
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      const errors: ValidationError[] = error.errors.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
      }));
      
      return {
        success: false,
        errors,
      };
    }
    
    return {
      success: false,
      errors: [{ field: 'unknown', message: 'Validation failed' }],
    };
  }
};

// ============================================================================
// CUSTOM VALIDATION HELPERS
// ============================================================================

/**
 * Validates that a value exists and is not null/undefined
 */
export const validateRequired = <T>(
  value: T | null | undefined,
  fieldName: string
): ValidationResult<T> => {
  if (value === null || value === undefined) {
    return {
      success: false,
      errors: [{ field: fieldName, message: `${fieldName} is required` }],
    };
  }
  
  return {
    success: true,
    data: value,
  };
};

/**
 * Validates that a value is one of the allowed values
 */
export const validateEnum = <T extends string>(
  value: string,
  allowedValues: readonly T[],
  fieldName: string
): ValidationResult<T> => {
  if (!allowedValues.includes(value as T)) {
    return {
      success: false,
      errors: [
        {
          field: fieldName,
          message: `${fieldName} must be one of: ${allowedValues.join(', ')}`,
        },
      ],
    };
  }
  
  return {
    success: true,
    data: value as T,
  };
};

/**
 * Combines multiple validation results
 */
export const combineValidationResults = <T extends Record<string, unknown>>(
  results: Record<keyof T, ValidationResult<T[keyof T]>>
): ValidationResult<T> => {
  const errors: ValidationError[] = [];
  const data: Partial<T> = {};
  
  for (const [key, result] of Object.entries(results)) {
    if (!result.success) {
      errors.push(...(result.errors || []));
    } else {
      data[key as keyof T] = result.data as T[keyof T];
    }
  }
  
  if (errors.length > 0) {
    return {
      success: false,
      errors,
    };
  }
  
  return {
    success: true,
    data: data as T,
  };
};

// ============================================================================
// EXPORTS
// ============================================================================

export const validation = {
  validateRequestBody,
  validateQueryParams,
  validatePathParams,
  createValidationErrorResponse,
  withValidation,
  safeParse,
  validatePartial,
  validateRequired,
  validateEnum,
  combineValidationResults,
};

export default validation;













