import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

type EnvInput = Record<string, string | undefined>;

const URL_PATTERN = "^[a-zA-Z][a-zA-Z0-9+.-]*://.+";
const OptionalString = () => Type.Optional(Type.String({ minLength: 1 }));

const EnvironmentSchema = Type.Object({
  NODE_ENV: Type.Union(
    [Type.Literal("development"), Type.Literal("production"), Type.Literal("test")],
    { default: "development" },
  ),
  PORT: Type.Number({ default: 3000, minimum: 1, maximum: 65535 }),
  APP_TIMEZONE: Type.String({ default: "America/Sao_Paulo", minLength: 1 }),

  DATABASE_URL: Type.String({ default: "postgresql://postgres:postgres@localhost:5432/atlasmed" }),
  DATABASE_POOL_MIN: Type.Number({ default: 2, minimum: 1 }),
  DATABASE_POOL_MAX: Type.Number({ default: 10, minimum: 1 }),

  REDIS_URL: Type.String({ default: "redis://localhost:6379", pattern: URL_PATTERN }),
  REDIS_KEY_PREFIX: Type.String({ default: "atlasmed:", minLength: 1 }),

  JWT_ACCESS_SECRET: Type.String({ default: "development-jwt-secret-at-least-32-chars", minLength: 32 }),
  JWT_EXPIRATION: Type.String({ default: "15m", minLength: 1 }),
  JWT_REFRESH_EXPIRATION: Type.String({ default: "7d", minLength: 1 }),
  JWT_ISSUER: Type.String({ default: "atlasmed-api", minLength: 1 }),
  JWT_AUDIENCE: Type.String({ default: "atlasmed", minLength: 1 }),

  CORS_ORIGINS: Type.String({ default: "http://localhost:3001", minLength: 1 }),
  FRONTEND_URL: Type.String({ default: "http://localhost:3001", pattern: URL_PATTERN }),

  RESEND_API_KEY: OptionalString(),
  RESEND_FROM_EMAIL: OptionalString(),
  TWILIO_ACCOUNT_SID: OptionalString(),
  TWILIO_AUTH_TOKEN: OptionalString(),
  TWILIO_PHONE_NUMBER: OptionalString(),
  TWILIO_WHATSAPP_NUMBER: OptionalString(),

  MAPBOX_SECRET_TOKEN: OptionalString(),
  MAPBOX_PUBLIC_TOKEN: OptionalString(),
  MAPBOX_USERNAME: Type.String({ default: "mapbox" }),

  RATE_LIMIT_WINDOW_MS: Type.Number({ default: 900000, minimum: 1000 }),
  RATE_LIMIT_MAX_REQUESTS: Type.Number({ default: 100, minimum: 1 }),
  SESSION_MAX_AGE_HOURS: Type.Number({ default: 24, minimum: 1 }),
  PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: Type.Number({ default: 60, minimum: 5 }),
  INVITE_EXPIRY_DAYS: Type.Number({ default: 7, minimum: 1 }),
  INVITE_MAX_RESENDS: Type.Number({ default: 5, minimum: 1 }),
  INVITE_RESEND_COOLDOWN_MINUTES: Type.Number({ default: 15, minimum: 1 }),
  MAX_LOGIN_ATTEMPTS: Type.Number({ default: 5, minimum: 1 }),
  LOGIN_LOCKOUT_MINUTES: Type.Number({ default: 15, minimum: 1 }),
  MAX_ACTIVE_SESSIONS_PER_USER: Type.Number({ default: 10, minimum: 1 }),

  OTEL_SERVICE_NAME: Type.String({ default: "atlasmed-api", minLength: 1 }),
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: OptionalString(),
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT: OptionalString(),
  OTEL_RESOURCE_ATTRIBUTES: OptionalString(),
  LOG_LEVEL: Type.Union(
    [Type.Literal("debug"), Type.Literal("info"), Type.Literal("warn"), Type.Literal("error")],
    { default: "info" },
  ),
  LOG_FORMAT: Type.Optional(Type.Union([Type.Literal("pretty"), Type.Literal("json")])),

  STORAGE_ENDPOINT: OptionalString(),
  STORAGE_ACCESS_KEY_ID: OptionalString(),
  STORAGE_SECRET_ACCESS_KEY: OptionalString(),
  STORAGE_BUCKET: OptionalString(),
  STORAGE_REGION: Type.String({ default: "us-east-1", minLength: 1 }),

  MEILISEARCH_URL: OptionalString(),
  MEILISEARCH_API_KEY: OptionalString(),

  ENABLE_SWAGGER: Type.Boolean({ default: true }),
  ENABLE_METRICS: Type.Boolean({ default: true }),
  ENABLE_AUDIT_LOG: Type.Boolean({ default: true }),
  TOKEN_HASH_PEPPER: OptionalString(),
  SESSION_SECURITY_MODE: Type.Union([Type.Literal("strict"), Type.Literal("audit_only")], {
    default: "strict",
  }),
  TRUST_PROXY: Type.Boolean({ default: false }),
  REQUIRE_EMAIL_VERIFIED_FOR_LOGIN: Type.Boolean({ default: false }),
  TWO_FACTOR_ENABLED: Type.Boolean({ default: false }),
  TWO_FACTOR_ENCRYPTION_KEY: Type.Optional(
    Type.String({ minLength: 64, maxLength: 64, pattern: "^[0-9a-fA-F]{64}$" }),
  ),
  SIEM_EXPORT_ENABLED: Type.Boolean({ default: false }),
  SIEM_WEBHOOK_URL: OptionalString(),
  SIEM_WEBHOOK_SECRET: Type.Optional(Type.String({ minLength: 8 })),
  AUDIT_LOG_RETENTION_DAYS: Type.Number({ default: 90, minimum: 1 }),

  REGISTRY_SOURCE: Type.Union([Type.Literal("mock"), Type.Literal("temporal")], {
    default: "temporal",
  }),
  REGISTRY_MOCK_FIXTURE: Type.String({ default: "snapshot-v1.json" }),
  TEMPORAL_ADDRESS: Type.String({ default: "localhost:7233", minLength: 1 }),
  TEMPORAL_NAMESPACE: Type.String({ default: "default", minLength: 1 }),
  TEMPORAL_TASK_QUEUE: Type.String({ default: "cnes-ingestion", minLength: 1 }),

  CNES_FTP_MODE: Type.Union([Type.Literal("mock"), Type.Literal("ftp")], { default: "mock" }),
  CNES_FTP_HOST: OptionalString(),
  CNES_FTP_USER: OptionalString(),
  CNES_FTP_PASSWORD: OptionalString(),
  CNES_FTP_BASE_PATH: Type.String({ default: "/cnes", minLength: 1 }),
  CNES_ARCHIVE_BACKEND: Type.Union(
    [Type.Literal("local"), Type.Literal("minio"), Type.Literal("s3")],
    { default: "local" },
  ),
  CNES_ARCHIVE_LOCAL_PATH: Type.String({ default: "/tmp/atlasmed-cnes-archive", minLength: 1 }),
  CNES_ARCHIVE_S3_BUCKET: OptionalString(),
  CNES_ARCHIVE_S3_REGION: Type.String({ default: "us-east-1", minLength: 1 }),
  CNES_ARCHIVE_S3_ENDPOINT: OptionalString(),
  CNES_ARCHIVE_S3_ACCESS_KEY_ID: OptionalString(),
  CNES_ARCHIVE_S3_SECRET_ACCESS_KEY: OptionalString(),
  CNES_LOAD_MODE: Type.Union([Type.Literal("ftp"), Type.Literal("dev")], { default: "dev" }),
  CNES_EXTRACT_DIR: Type.String({ default: "/tmp/cnes-extract", minLength: 1 }),
  CNES_PYTHON_BIN: Type.String({ default: "python3", minLength: 1 }),
  CNES_IMPORT_SCRIPT: OptionalString(),
  CNES_VALIDATION_ROW_TOLERANCE_PCT: Type.Number({ default: 15, minimum: 0 }),
  CNES_DEV_LOAD_SOURCE_SCHEMA: Type.String({ default: "mcp_test", minLength: 1 }),
  CNES_LOAD_CONCURRENCY: Type.Number({ default: 4, minimum: 1 }),

  NEXT_PUBLIC_API_URL: Type.String({ default: "http://localhost:3000/api/v1", pattern: URL_PATTERN }),
  NEXT_PUBLIC_HEALTH_URL: Type.String({ default: "http://localhost:3000", pattern: URL_PATTERN }),
  NEXT_PUBLIC_MAP_PROVIDER: Type.Union([Type.Literal("leaflet"), Type.Literal("mapbox")], {
    default: "leaflet",
  }),

  UNCLOUD_CONNECT: OptionalString(),
  TEMPORAL_DB_PASSWORD: OptionalString(),
  MINIO_ROOT_USER: OptionalString(),
  MINIO_ROOT_PASSWORD: OptionalString(),
});

export type Environment = Static<typeof EnvironmentSchema>;

const numberFromEnv = (value: string | undefined, fallback: number): number => Number(value ?? fallback);

const booleanFromEnv = (value: string | undefined, fallback: boolean): boolean => {
  if (value === undefined || value === "") return fallback;
  return value === "true" || value === "1";
};

function normalizeEnvironment(env: EnvInput) {
  return {
    ...env,
    NODE_ENV: env.NODE_ENV ?? "development",
    PORT: numberFromEnv(env.PORT, 3000),
    APP_TIMEZONE: env.APP_TIMEZONE ?? "America/Sao_Paulo",
    DATABASE_URL: env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/atlasmed",
    DATABASE_POOL_MIN: numberFromEnv(env.DATABASE_POOL_MIN, 2),
    DATABASE_POOL_MAX: numberFromEnv(env.DATABASE_POOL_MAX, 10),
    REDIS_URL: env.REDIS_URL ?? "redis://localhost:6379",
    REDIS_KEY_PREFIX: env.REDIS_KEY_PREFIX ?? "atlasmed:",
    JWT_ACCESS_SECRET: env.JWT_ACCESS_SECRET ?? env.JWT_SECRET ?? "development-jwt-secret-at-least-32-chars",
    JWT_EXPIRATION: env.JWT_EXPIRATION ?? env.JWT_EXPIRES_IN ?? "15m",
    JWT_REFRESH_EXPIRATION: env.JWT_REFRESH_EXPIRATION ?? "7d",
    JWT_ISSUER: env.JWT_ISSUER ?? "atlasmed-api",
    JWT_AUDIENCE: env.JWT_AUDIENCE ?? "atlasmed",
    CORS_ORIGINS: env.CORS_ORIGINS ?? "http://localhost:3001",
    FRONTEND_URL: env.FRONTEND_URL ?? "http://localhost:3001",
    TWILIO_WHATSAPP_NUMBER: env.TWILIO_WHATSAPP_NUMBER ?? env.TWILIO_WHATSAPP_FROM,
    MAPBOX_USERNAME: env.MAPBOX_USERNAME ?? "mapbox",
    RATE_LIMIT_WINDOW_MS: numberFromEnv(env.RATE_LIMIT_WINDOW_MS, 900000),
    RATE_LIMIT_MAX_REQUESTS: numberFromEnv(env.RATE_LIMIT_MAX_REQUESTS, 100),
    SESSION_MAX_AGE_HOURS: numberFromEnv(env.SESSION_MAX_AGE_HOURS, 24),
    PASSWORD_RESET_TOKEN_EXPIRY_MINUTES: numberFromEnv(env.PASSWORD_RESET_TOKEN_EXPIRY_MINUTES, 60),
    INVITE_EXPIRY_DAYS: numberFromEnv(env.INVITE_EXPIRY_DAYS, 7),
    INVITE_MAX_RESENDS: numberFromEnv(env.INVITE_MAX_RESENDS, 5),
    INVITE_RESEND_COOLDOWN_MINUTES: numberFromEnv(env.INVITE_RESEND_COOLDOWN_MINUTES, 15),
    MAX_LOGIN_ATTEMPTS: numberFromEnv(env.MAX_LOGIN_ATTEMPTS, 5),
    LOGIN_LOCKOUT_MINUTES: numberFromEnv(env.LOGIN_LOCKOUT_MINUTES, 15),
    MAX_ACTIVE_SESSIONS_PER_USER: numberFromEnv(env.MAX_ACTIVE_SESSIONS_PER_USER, 10),
    OTEL_SERVICE_NAME: env.OTEL_SERVICE_NAME ?? "atlasmed-api",
    LOG_LEVEL: env.LOG_LEVEL ?? "info",
    STORAGE_REGION: env.STORAGE_REGION ?? "us-east-1",
    ENABLE_SWAGGER: booleanFromEnv(env.ENABLE_SWAGGER, true),
    ENABLE_METRICS: booleanFromEnv(env.ENABLE_METRICS, true),
    ENABLE_AUDIT_LOG: booleanFromEnv(env.ENABLE_AUDIT_LOG, true),
    SESSION_SECURITY_MODE: env.SESSION_SECURITY_MODE === "audit_only" ? "audit_only" : "strict",
    TRUST_PROXY: booleanFromEnv(env.TRUST_PROXY, false),
    REQUIRE_EMAIL_VERIFIED_FOR_LOGIN: booleanFromEnv(env.REQUIRE_EMAIL_VERIFIED_FOR_LOGIN, false),
    TWO_FACTOR_ENABLED: booleanFromEnv(env.TWO_FACTOR_ENABLED, false),
    SIEM_EXPORT_ENABLED: booleanFromEnv(env.SIEM_EXPORT_ENABLED, false),
    AUDIT_LOG_RETENTION_DAYS: numberFromEnv(env.AUDIT_LOG_RETENTION_DAYS, 90),
    REGISTRY_SOURCE: env.REGISTRY_SOURCE === "mock" ? "mock" : "temporal",
    REGISTRY_MOCK_FIXTURE: env.REGISTRY_MOCK_FIXTURE ?? "snapshot-v1.json",
    TEMPORAL_ADDRESS: env.TEMPORAL_ADDRESS ?? "localhost:7233",
    TEMPORAL_NAMESPACE: env.TEMPORAL_NAMESPACE ?? "default",
    TEMPORAL_TASK_QUEUE: env.TEMPORAL_TASK_QUEUE ?? "cnes-ingestion",
    CNES_FTP_MODE: env.CNES_FTP_MODE === "ftp" ? "ftp" : "mock",
    CNES_FTP_BASE_PATH: env.CNES_FTP_BASE_PATH ?? "/cnes",
    CNES_ARCHIVE_BACKEND: env.CNES_ARCHIVE_BACKEND ?? "local",
    CNES_ARCHIVE_LOCAL_PATH: env.CNES_ARCHIVE_LOCAL_PATH ?? "/tmp/atlasmed-cnes-archive",
    CNES_ARCHIVE_S3_REGION: env.CNES_ARCHIVE_S3_REGION ?? "us-east-1",
    CNES_LOAD_MODE: env.CNES_LOAD_MODE === "ftp" ? "ftp" : "dev",
    CNES_EXTRACT_DIR: env.CNES_EXTRACT_DIR ?? "/tmp/cnes-extract",
    CNES_PYTHON_BIN: env.CNES_PYTHON_BIN ?? "python3",
    CNES_VALIDATION_ROW_TOLERANCE_PCT: numberFromEnv(env.CNES_VALIDATION_ROW_TOLERANCE_PCT, 15),
    CNES_DEV_LOAD_SOURCE_SCHEMA: env.CNES_DEV_LOAD_SOURCE_SCHEMA ?? "mcp_test",
    CNES_LOAD_CONCURRENCY: numberFromEnv(env.CNES_LOAD_CONCURRENCY, 4),
    NEXT_PUBLIC_API_URL: env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1",
    NEXT_PUBLIC_HEALTH_URL: env.NEXT_PUBLIC_HEALTH_URL ?? "http://localhost:3000",
    NEXT_PUBLIC_MAP_PROVIDER: env.NEXT_PUBLIC_MAP_PROVIDER ?? "leaflet",
  };
}

function validationIssues(value: unknown): string[] {
  return [...Value.Errors(EnvironmentSchema, value)].map((error) => {
    const path = error.path || "/";
    return `${path}: ${error.message}`;
  });
}

function productionIssues(env: Environment, rawEnv: EnvInput): string[] {
  if (env.NODE_ENV !== "production") return [];

  const required = [
    "UNCLOUD_CONNECT",
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_ACCESS_SECRET",
    "TOKEN_HASH_PEPPER",
    "CORS_ORIGINS",
    "FRONTEND_URL",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "TEMPORAL_DB_PASSWORD",
    "MEILISEARCH_API_KEY",
    "MINIO_ROOT_USER",
    "MINIO_ROOT_PASSWORD",
  ];

  const issues = required
    .filter((key) => !rawEnv[key])
    .map((key) => `/${key}: required in production`);

  if (env.SESSION_SECURITY_MODE !== "strict") {
    issues.push("/SESSION_SECURITY_MODE: must be strict in production");
  }

  if (rawEnv.UNCLOUD_CONNECT && !/^ssh(\+cli)?:\/\/[^@]+@.+/.test(rawEnv.UNCLOUD_CONNECT)) {
    issues.push("/UNCLOUD_CONNECT: must be an ssh:// or ssh+cli:// target");
  }

  if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
    issues.push("/DATABASE_URL: must be a postgres:// or postgresql:// URL");
  }

  if (!env.FRONTEND_URL.startsWith("https://")) {
    issues.push("/FRONTEND_URL: must be an https:// URL");
  }

  for (const origin of env.CORS_ORIGINS.split(",")) {
    if (!origin.trim().startsWith("https://")) {
      issues.push("/CORS_ORIGINS: entries must be https:// origins");
      break;
    }
  }

  if (env.JWT_ACCESS_SECRET.length < 32) {
    issues.push("/JWT_ACCESS_SECRET: must be at least 32 characters");
  }

  if (!env.TOKEN_HASH_PEPPER || env.TOKEN_HASH_PEPPER.length < 32) {
    issues.push("/TOKEN_HASH_PEPPER: must be at least 32 characters");
  }

  if (env.TEMPORAL_DB_PASSWORD && env.TEMPORAL_DB_PASSWORD.length < 16) {
    issues.push("/TEMPORAL_DB_PASSWORD: must be at least 16 characters");
  }

  if (env.MEILISEARCH_API_KEY && env.MEILISEARCH_API_KEY.length < 16) {
    issues.push("/MEILISEARCH_API_KEY: must be at least 16 characters");
  }

  if (env.MINIO_ROOT_PASSWORD && env.MINIO_ROOT_PASSWORD.length < 16) {
    issues.push("/MINIO_ROOT_PASSWORD: must be at least 16 characters");
  }

  if (env.TWO_FACTOR_ENABLED && !env.TWO_FACTOR_ENCRYPTION_KEY) {
    issues.push("/TWO_FACTOR_ENCRYPTION_KEY: required when TWO_FACTOR_ENABLED=true");
  }

  if (env.CNES_FTP_MODE === "ftp" && !env.CNES_FTP_HOST) {
    issues.push("/CNES_FTP_HOST: required when CNES_FTP_MODE=ftp");
  }

  if (env.CNES_ARCHIVE_BACKEND === "s3" && !env.CNES_ARCHIVE_S3_BUCKET) {
    issues.push("/CNES_ARCHIVE_S3_BUCKET: required when CNES_ARCHIVE_BACKEND=s3");
  }

  return issues;
}

export function getEnvironment(env: EnvInput = process.env): Environment {
  const normalized = normalizeEnvironment(env);
  if (!Value.Check(EnvironmentSchema, normalized)) {
    throw new Error(`Environment validation failed:\n${validationIssues(normalized).join("\n")}`);
  }
  return Value.Decode(EnvironmentSchema, normalized) as Environment;
}

export function checkEnvironment(env: EnvInput = process.env): void {
  const normalized = normalizeEnvironment(env);
  const issues = validationIssues(normalized);

  if (issues.length === 0) {
    const parsed = Value.Decode(EnvironmentSchema, normalized) as Environment;
    issues.push(...productionIssues(parsed, env));
  }

  if (issues.length > 0) {
    console.error("\nInvalid environment variables detected:\n");
    for (const issue of issues) {
      console.error(`  - ${issue}`);
    }
    console.error("");
    process.exit(1);
  }
}

export const environment = getEnvironment();
