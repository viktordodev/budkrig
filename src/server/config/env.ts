import { z } from "zod";

/**
 * The single place env vars enter the app. Import the typed `env` object;
 * never read `process.env` elsewhere in server/ or modules/.
 * Keys mirror .env.example.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "preview", "production"]).default("local"),
  APP_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),
  DATABASE_MIGRATION_URL: z.string().url().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),

  REDIS_URL: z.string().url(),

  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_TAX_ENABLED: z.coerce.boolean().default(true),

  CURRENCY: z.literal("SEK").default("SEK"),
  NEW_LISTING_MIN_ORE: z.coerce.number().int().positive().default(500),
  MIN_INCREMENT_ORE: z.coerce.number().int().positive().default(100),
  PENDING_BID_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  TIMEZONE: z.string().default("Europe/Stockholm"),

  LISTING_MANAGEMENT_JWT_SECRET: z.string().min(32),
  MANAGE_LINK_TTL_HOURS: z.coerce.number().int().positive().default(24),
  IP_HASH_SALT: z.string().min(16),

  EMAIL_PROVIDER: z.enum(["resend", "postmark", "smtp"]).default("smtp"),
  EMAIL_FROM: z.string(),
  RESEND_API_KEY: z.string().optional(),
  SMTP_URL: z.string().url().optional(),

  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("eu-central-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  SAFE_BROWSING_API_KEY: z.string().optional(),

  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SENTRY_DSN: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  PLAUSIBLE_DOMAIN: z.string().optional(),

  OPERATOR_ALLOWED_EMAILS: z
    .string()
    .default("")
    .transform((s) => s.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`);
  console.error(`Invalid environment:\n${lines.join("\n")}`);
  throw new Error("Environment validation failed");
}

export const env = parsed.data;
export type Env = typeof env;
