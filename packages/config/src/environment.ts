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

  /** Internal S3-compatible endpoint the API/workers use for server-side calls. */
  STORAGE_ENDPOINT: OptionalString(),
  /**
   * Public S3-compatible base URL used when signing client-facing URLs. Must be reachable
   * from phones/browsers. Never falls back to STORAGE_ENDPOINT — a cluster-internal
   * hostname signed into a presigned URL is unreachable and leaks topology.
   */
  STORAGE_PUBLIC_ENDPOINT: OptionalString(),
  STORAGE_ACCESS_KEY_ID: OptionalString(),
  STORAGE_SECRET_ACCESS_KEY: OptionalString(),
  STORAGE_BUCKET: OptionalString(),
  STORAGE_REGION: Type.String({ default: "us-east-1", minLength: 1 }),
  AVATAR_STORAGE_LOCAL_PATH: Type.String({ default: "/tmp/atlasmed-avatars", minLength: 1 }),

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

  TEMPORAL_ADDRESS: Type.String({ default: "localhost:7233", minLength: 1 }),
  TEMPORAL_NAMESPACE: Type.String({ default: "default", minLength: 1 }),
  TEMPORAL_TASK_QUEUE: Type.String({ default: "atlasmed-workflows", minLength: 1 }),

  /** Emultec MySQL (order/product import). Optional until import workers run. */
  EMULTEC_MYSQL_HOST: OptionalString(),
  EMULTEC_MYSQL_PORT: Type.Number({ default: 3306, minimum: 1, maximum: 65535 }),
  EMULTEC_MYSQL_USER: OptionalString(),
  EMULTEC_MYSQL_PASSWORD: OptionalString(),
  EMULTEC_MYSQL_DATABASE: Type.String({ default: "atlasmed", minLength: 1 }),

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

/**
 * An unset variable interpolated by compose (`FOO=${FOO}`) or by a GitHub
 * Actions expression that resolves to nothing arrives as an empty string, not
 * as undefined. Treat the two identically, so "deleted the variable" produces
 * the same clear "required" message as "never set it" instead of a raw schema
 * violation about string length.
 */
function withoutEmptyValues(env: EnvInput): EnvInput {
  const out: EnvInput = {};
  for (const [key, value] of Object.entries(env)) {
    if (value !== "") out[key] = value;
  }
  return out;
}

function normalizeEnvironment(rawEnv: EnvInput) {
  const env = withoutEmptyValues(rawEnv);
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
    AVATAR_STORAGE_LOCAL_PATH: env.AVATAR_STORAGE_LOCAL_PATH ?? "/tmp/atlasmed-avatars",
    ENABLE_SWAGGER: booleanFromEnv(env.ENABLE_SWAGGER, true),
    ENABLE_METRICS: booleanFromEnv(env.ENABLE_METRICS, true),
    ENABLE_AUDIT_LOG: booleanFromEnv(env.ENABLE_AUDIT_LOG, true),
    SESSION_SECURITY_MODE: env.SESSION_SECURITY_MODE === "audit_only" ? "audit_only" : "strict",
    TRUST_PROXY: booleanFromEnv(env.TRUST_PROXY, false),
    REQUIRE_EMAIL_VERIFIED_FOR_LOGIN: booleanFromEnv(env.REQUIRE_EMAIL_VERIFIED_FOR_LOGIN, false),
    TWO_FACTOR_ENABLED: booleanFromEnv(env.TWO_FACTOR_ENABLED, false),
    SIEM_EXPORT_ENABLED: booleanFromEnv(env.SIEM_EXPORT_ENABLED, false),
    AUDIT_LOG_RETENTION_DAYS: numberFromEnv(env.AUDIT_LOG_RETENTION_DAYS, 90),
    TEMPORAL_ADDRESS: env.TEMPORAL_ADDRESS ?? "localhost:7233",
    TEMPORAL_NAMESPACE: env.TEMPORAL_NAMESPACE ?? "default",
    TEMPORAL_TASK_QUEUE: env.TEMPORAL_TASK_QUEUE ?? "atlasmed-workflows",
    EMULTEC_MYSQL_PORT: numberFromEnv(env.EMULTEC_MYSQL_PORT, 3306),
    EMULTEC_MYSQL_DATABASE: env.EMULTEC_MYSQL_DATABASE ?? "atlasmed",
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

/**
 * Variables that exist on the deploy host and in CI but are deliberately NOT
 * injected into any application container: UNCLOUD_CONNECT is the ssh target
 * for the deploy CLI, TEMPORAL_DB_PASSWORD belongs to the Temporal Postgres
 * service, and MINIO_ROOT_* provision the MinIO server itself. A running API
 * has none of them and must never be asked for them — see `environmentIssues`.
 */
const DEPLOYMENT_ONLY_REQUIRED = [
  "UNCLOUD_CONNECT",
  "TEMPORAL_DB_PASSWORD",
  "MINIO_ROOT_USER",
  "MINIO_ROOT_PASSWORD",
] as const;

function productionIssues(env: Environment, rawEnv: EnvInput): string[] {
  if (env.NODE_ENV !== "production") return [];

  const required = [
    ...DEPLOYMENT_ONLY_REQUIRED,
    "DATABASE_URL",
    "REDIS_URL",
    "JWT_ACCESS_SECRET",
    "TOKEN_HASH_PEPPER",
    "CORS_ORIGINS",
    "FRONTEND_URL",
    "RESEND_API_KEY",
    "RESEND_FROM_EMAIL",
    "MEILISEARCH_API_KEY",
  ];

  const issues = required
    .filter((key) => !rawEnv[key])
    .map((key) => `/${key}: required in production`);

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

  issues.push(...storageConfigIssues(env));

  return issues;
}

const R2_ENDPOINT_PATTERN = /(^|\.)r2\.cloudflarestorage\.com(:|\/|$)/i;

export function isR2Endpoint(endpoint: string | undefined): boolean {
  return Boolean(endpoint && R2_ENDPOINT_PATTERN.test(endpoint));
}

/**
 * Every variable the object-storage client needs. All five are required
 * together: the credentials sign the request, the bucket names the target, the
 * internal endpoint is what the server talks to, and the public endpoint is
 * what gets baked into presigned URLs handed to phones. Any one missing
 * produces requests that are signed wrong, aimed wrong, or unreachable.
 */
export const STORAGE_REQUIRED_KEYS = [
  "STORAGE_ENDPOINT",
  "STORAGE_PUBLIC_ENDPOINT",
  "STORAGE_ACCESS_KEY_ID",
  "STORAGE_SECRET_ACCESS_KEY",
  "STORAGE_BUCKET",
] as const;

export type StorageConfigKey = (typeof STORAGE_REQUIRED_KEYS)[number];

export type StorageConfigInput = {
  NODE_ENV?: string;
  STORAGE_REGION?: string;
} & Partial<Record<StorageConfigKey, string>>;

/**
 * Every problem with the object-storage configuration; empty means usable.
 *
 * This is the single rule set: the CI `env:check` gate and the API/worker boot
 * gate both call it, so a config that passes CI is a config that boots.
 *
 * Outside production a completely empty storage configuration is allowed —
 * local development without MinIO simply runs with storage features off. A
 * *partial* configuration is rejected everywhere, because that is the shape a
 * typo or a dropped deploy variable takes, never a deliberate "storage off".
 */
export function storageConfigIssues(env: StorageConfigInput): string[] {
  const issues: string[] = [];
  const isProduction = env.NODE_ENV === "production";
  const missing = STORAGE_REQUIRED_KEYS.filter((key) => !env[key]);

  if (isProduction) {
    for (const key of missing) {
      issues.push(`/${key}: required in production`);
    }
  } else if (missing.length > 0 && missing.length < STORAGE_REQUIRED_KEYS.length) {
    for (const key of missing) {
      issues.push(`/${key}: required when object storage is configured`);
    }
  }

  const absoluteUrl = new RegExp(URL_PATTERN);

  if (env.STORAGE_ENDPOINT && !absoluteUrl.test(env.STORAGE_ENDPOINT)) {
    issues.push("/STORAGE_ENDPOINT: must be an absolute URL");
  }

  if (env.STORAGE_PUBLIC_ENDPOINT) {
    if (!absoluteUrl.test(env.STORAGE_PUBLIC_ENDPOINT)) {
      issues.push("/STORAGE_PUBLIC_ENDPOINT: must be an absolute URL");
    } else if (isProduction && !env.STORAGE_PUBLIC_ENDPOINT.startsWith("https://")) {
      // Signed into URLs that leave the cluster; http:// would ship user
      // documents over plaintext and is rejected outright by mobile ATS/NSC.
      issues.push(
        "/STORAGE_PUBLIC_ENDPOINT: must be an https:// URL reachable by mobile clients",
      );
    }
  }

  // R2 rejects any region other than "auto", in every environment.
  if (isR2Endpoint(env.STORAGE_ENDPOINT) || isR2Endpoint(env.STORAGE_PUBLIC_ENDPOINT)) {
    if (env.STORAGE_REGION !== "auto") {
      issues.push('/STORAGE_REGION: must be "auto" when using Cloudflare R2');
    }
  }

  return issues;
}

/**
 * Boot gate for any process that touches object storage. Throws rather than
 * exiting so the caller decides how to report — see apps/api/src/app/server.ts
 * and apps/workers/temporal/src/worker.ts.
 */
export function assertStorageConfig(env: StorageConfigInput = environment): void {
  const issues = storageConfigIssues(env);
  if (issues.length === 0) return;

  throw new Error(
    `Object storage is misconfigured; refusing to start:\n${issues
      .map((issue) => `  - ${issue}`)
      .join("\n")}`,
  );
}

export function getEnvironment(env: EnvInput = process.env): Environment {
  const normalized = normalizeEnvironment(env);
  if (!Value.Check(EnvironmentSchema, normalized)) {
    throw new Error(`Environment validation failed:\n${validationIssues(normalized).join("\n")}`);
  }
  return Value.Decode(EnvironmentSchema, normalized) as Environment;
}

/**
 * All validation problems with `env`, schema issues first. Returns an empty
 * array when the environment is usable. Pure — safe to call from tests.
 *
 * This is the **deploy-time** gate: it assumes the full deployment environment,
 * including DEPLOYMENT_ONLY_REQUIRED variables that no application container
 * ever receives. Do not call it from a running service — a correctly deployed
 * API would fail it. Services validate the subset they actually consume; for
 * object storage that is `assertStorageConfig`.
 */
export function environmentIssues(env: EnvInput = process.env): string[] {
  const normalized = normalizeEnvironment(env);
  const issues = validationIssues(normalized);

  if (issues.length === 0) {
    const parsed = Value.Decode(EnvironmentSchema, normalized) as Environment;
    issues.push(...productionIssues(parsed, env));
  }

  return issues;
}

export function checkEnvironment(env: EnvInput = process.env): void {
  const issues = environmentIssues(env);

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
