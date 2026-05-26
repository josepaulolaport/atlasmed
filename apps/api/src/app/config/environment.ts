/**
 * Environment Configuration with Validation
 * 
 * All environment variables are validated at startup.
 * The application will fail fast if any required variables are missing or invalid.
 */

import { Type } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';

// Custom type validators
const URL_PATTERN = '^[a-zA-Z][a-zA-Z0-9+.-]*://.+';
const RequiredString = () => Type.String({ minLength: 1 });
const RequiredUrl = () => Type.String({ minLength: 1, pattern: URL_PATTERN });
const OptionalString = () => Type.Optional(Type.String({ minLength: 1 }));

/**
 * Environment Schema Definition
 * 
 * Defines all required and optional environment variables with validation rules.
 */
const EnvironmentSchema = Type.Object({
  // ============================================================================
  // Application Configuration
  // ============================================================================
  NODE_ENV: Type.Union([
    Type.Literal('development'),
    Type.Literal('production'),
    Type.Literal('test')
  ], { default: 'development' }),
  
  PORT: Type.Number({ 
    default: 3000, 
    minimum: 1, 
    maximum: 65535 
  }),
  
  // ============================================================================
  // Database Configuration
  // ============================================================================
  DATABASE_URL: RequiredUrl(),
  
  DATABASE_POOL_MIN: Type.Number({ 
    default: 2, 
    minimum: 1,
    description: 'Minimum number of database connections in the pool'
  }),
  
  DATABASE_POOL_MAX: Type.Number({ 
    default: 10, 
    minimum: 1,
    description: 'Maximum number of database connections in the pool'
  }),
  
  // ============================================================================
  // Redis Configuration
  // ============================================================================
  REDIS_URL: RequiredUrl(),
  
  REDIS_KEY_PREFIX: Type.String({ 
    default: 'atlasmed:', 
    minLength: 1,
    description: 'Prefix for all Redis keys'
  }),
  
  // ============================================================================
  // JWT Configuration
  // ============================================================================
  JWT_ACCESS_SECRET: Type.String({ 
    minLength: 32,
    description: 'Secret for signing access tokens (minimum 32 characters)'
  }),
  
  JWT_REFRESH_SECRET: Type.String({ 
    minLength: 32,
    description: 'Secret for signing refresh tokens (minimum 32 characters)'
  }),
  
  JWT_EXPIRATION: Type.String({ 
    default: '15m', 
    minLength: 1,
    description: 'Access token expiration time (e.g., "15m", "1h")'
  }),
  
  JWT_REFRESH_EXPIRATION: Type.String({ 
    default: '7d', 
    minLength: 1,
    description: 'Refresh token expiration time (e.g., "7d", "30d")'
  }),
  
  // ============================================================================
  // CORS Configuration
  // ============================================================================
  CORS_ORIGINS: RequiredString(),
  
  FRONTEND_URL: RequiredUrl(),
  
  // ============================================================================
  // External Services
  // ============================================================================
  RESEND_API_KEY: RequiredString(),
  
  TWILIO_ACCOUNT_SID: OptionalString(),
  TWILIO_AUTH_TOKEN: OptionalString(),
  TWILIO_PHONE_NUMBER: OptionalString(),
  TWILIO_WHATSAPP_NUMBER: OptionalString(),
  
  // ============================================================================
  // Rate Limiting Configuration
  // ============================================================================
  RATE_LIMIT_WINDOW_MS: Type.Number({ 
    default: 900000, // 15 minutes
    minimum: 1000,
    description: 'Rate limit window in milliseconds'
  }),
  
  RATE_LIMIT_MAX_REQUESTS: Type.Number({ 
    default: 100, 
    minimum: 1,
    description: 'Maximum requests per window'
  }),
  
  // ============================================================================
  // Security Configuration
  // ============================================================================
  SESSION_MAX_AGE_HOURS: Type.Number({ 
    default: 24, 
    minimum: 1,
    description: 'Maximum session age in hours'
  }),
  
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: Type.Number({ 
    default: 60, 
    minimum: 5,
    description: 'Password reset token expiry in minutes'
  }),
  
  INVITE_EXPIRY_DAYS: Type.Number({ 
    default: 7, 
    minimum: 1,
    description: 'Invitation expiry in days'
  }),
  
  MAX_LOGIN_ATTEMPTS: Type.Number({ 
    default: 5, 
    minimum: 1,
    description: 'Maximum login attempts before account lockout'
  }),
  
  LOGIN_LOCKOUT_MINUTES: Type.Number({ 
    default: 15, 
    minimum: 1,
    description: 'Account lockout duration in minutes'
  }),
  
  // ============================================================================
  // Observability Configuration
  // ============================================================================
  OTEL_SERVICE_NAME: Type.String({ 
    default: 'atlasmed-api', 
    minLength: 1,
    description: 'Service name for OpenTelemetry'
  }),
  
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: Type.Optional(
    Type.String({ 
      minLength: 1, 
      pattern: URL_PATTERN,
      description: 'OpenTelemetry traces endpoint (optional)'
    })
  ),
  
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: Type.Optional(
    Type.String({ 
      minLength: 1, 
      pattern: URL_PATTERN,
      description: 'OpenTelemetry logs endpoint (optional)'
    })
  ),
  
  LOG_LEVEL: Type.Union([
    Type.Literal('debug'),
    Type.Literal('info'),
    Type.Literal('warn'),
    Type.Literal('error')
  ], { default: 'info' }),
  
  // ============================================================================
  // Feature Flags
  // ============================================================================
  ENABLE_SWAGGER: Type.Boolean({ 
    default: true,
    description: 'Enable Swagger UI'
  }),
  
  ENABLE_METRICS: Type.Boolean({ 
    default: true,
    description: 'Enable Prometheus metrics'
  }),
  
  ENABLE_AUDIT_LOG: Type.Boolean({ 
    default: true,
    description: 'Enable audit logging'
  }),

  TOKEN_HASH_PEPPER: Type.Optional(
    Type.String({
      minLength: 16,
      description: 'HMAC pepper for hashing invite/reset/refresh tokens at rest',
    })
  ),

  SESSION_SECURITY_MODE: Type.Union(
    [Type.Literal('strict'), Type.Literal('audit_only')],
    { default: 'strict', description: 'strict blocks refresh on fingerprint/IP drift; audit_only logs only' }
  ),

  REQUIRE_EMAIL_VERIFIED_FOR_LOGIN: Type.Boolean({
    default: false,
    description: 'When true, users must verify email before password login',
  }),

  TWO_FACTOR_ENABLED: Type.Boolean({
    default: false,
    description: 'Feature flag stub — 2FA not implemented yet',
  }),
});

/**
 * Process environment with defaults applied
 */
const processEnv = {
  ...process.env,
  // Application
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: Number(process.env.PORT ?? 3000),
  
  // Database
  DATABASE_POOL_MIN: Number(process.env.DATABASE_POOL_MIN ?? 2),
  DATABASE_POOL_MAX: Number(process.env.DATABASE_POOL_MAX ?? 10),
  
  // Redis
  REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX ?? 'atlasmed:',
  
  // JWT
  JWT_EXPIRATION: process.env.JWT_EXPIRATION ?? '15m',
  JWT_REFRESH_EXPIRATION: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
  RATE_LIMIT_MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 100),
  
  // Security
  SESSION_MAX_AGE_HOURS: Number(process.env.SESSION_MAX_AGE_HOURS ?? 24),
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: Number(process.env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES ?? 60),
  INVITE_EXPIRY_DAYS: Number(process.env.INVITE_EXPIRY_DAYS ?? 7),
  MAX_LOGIN_ATTEMPTS: Number(process.env.MAX_LOGIN_ATTEMPTS ?? 5),
  LOGIN_LOCKOUT_MINUTES: Number(process.env.LOGIN_LOCKOUT_MINUTES ?? 15),
  
  // Observability
  OTEL_SERVICE_NAME: process.env.OTEL_SERVICE_NAME ?? 'atlasmed-api',
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
  
  // QuestDB
  QUESTDB_ENABLED: process.env.QUESTDB_ENABLED === 'true',
  QUESTDB_HOST: process.env.QUESTDB_HOST ?? 'localhost',
  QUESTDB_PORT: parseInt(process.env.QUESTDB_PORT ?? '9009', 10),
  
  // Feature Flags
  ENABLE_SWAGGER: process.env.ENABLE_SWAGGER !== 'false',
  ENABLE_METRICS: process.env.ENABLE_METRICS !== 'false',
  ENABLE_AUDIT_LOG: process.env.ENABLE_AUDIT_LOG !== 'false',

  SESSION_SECURITY_MODE: (process.env.SESSION_SECURITY_MODE === 'audit_only'
    ? 'audit_only'
    : 'strict') as 'strict' | 'audit_only',
  REQUIRE_EMAIL_VERIFIED_FOR_LOGIN:
    process.env.REQUIRE_EMAIL_VERIFIED_FOR_LOGIN === 'true',
  TWO_FACTOR_ENABLED: process.env.TWO_FACTOR_ENABLED === 'true',
};

// Validate environment at startup
if (!Value.Check(EnvironmentSchema, processEnv)) {
  const errors = [...Value.Errors(EnvironmentSchema, processEnv)];
  
  console.error('\n❌ Invalid environment variables detected!\n');
  
  errors.forEach((error) => {
    console.error(`  • ${error.path}: ${error.message}`);
  });
  
  console.error('\nPlease check your .env file and ensure all required variables are set.\n');
  
  throw new Error('Environment validation failed');
}

/**
 * Validated and typed environment configuration
 * 
 * Safe to use throughout the application with full type safety.
 */
export const environment = Value.Decode(EnvironmentSchema, processEnv);

/**
 * Type definition for the environment
 */
export type Environment = typeof environment;

/**
 * Helper function to check if we're in development mode
 */
export const isDevelopment = () => environment.NODE_ENV === 'development';

/**
 * Helper function to check if we're in production mode
 */
export const isProduction = () => environment.NODE_ENV === 'production';

/**
 * Helper function to check if we're in test mode
 */
export const isTest = () => environment.NODE_ENV === 'test';
