import { z } from "zod";

/**
 * The single place env vars enter the app. Import the typed `env` object;
 * never read `process.env` elsewhere in server/ or modules/. Keys mirror
 * .env.example.
 *
 * During `next build` / image build / CI there is no real environment, so
 * SKIP_ENV_VALIDATION=1 bypasses parsing. Never set it at runtime.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["local", "preview", "production"]).default("local"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().url(),
  DATABASE_MIGRATION_URL: z.string().url().optional(),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().max(50).default(10),

  REDIS_URL: z.string().url(),

  // Required from Milestone 2 (payments). Optional now so the skeleton boots.
  STRIPE_SECRET_KEY: z.string().startsWith("sk_").optional(),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_").optional(),
  // Off by default — turning it on before Stripe Tax is activated on the
  // account breaks checkout. Flip once Tax is set up (ADR-0007 / ADR-0015).
  STRIPE_TAX_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Checkout methods, in display order. Swish before credit (2020 SE law,
  // ADR-0007). `card` alone by default — add "swish", "klarna" once each is
  // activated on the Stripe account, else checkout errors.
  CHECKOUT_PAYMENT_METHODS: z
    .string()
    .default("card")
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    ),

  CURRENCY: z.literal("SEK").default("SEK"),
  NEW_LISTING_MIN_ORE: z.coerce.number().int().positive().default(500),
  MIN_INCREMENT_ORE: z.coerce.number().int().positive().default(100),
  PENDING_BID_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  TIMEZONE: z.string().default("Europe/Stockholm"),

  LISTING_MANAGEMENT_JWT_SECRET: z
    .string()
    .min(32)
    .default("dev-only-insecure-listing-mgmt-secret-32b"),
  MANAGE_LINK_TTL_HOURS: z.coerce.number().int().positive().default(24),
  IP_HASH_SALT: z.string().min(16).default("dev-only-insecure-ip-salt"),

  EMAIL_PROVIDER: z.enum(["resend", "postmark", "smtp"]).default("smtp"),
  EMAIL_FROM: z.string().default("Budkrig <no-reply@budkrig.se>"),
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
    .transform((s) =>
      s
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
});

export type Env = z.infer<typeof schema>;

/** Treat `FOO=` (empty string) as unset — a common .env footgun with optional keys. */
function withoutBlanks(source: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(source)) {
    out[key] = value === "" ? undefined : value;
  }
  return out;
}

function load(): Env {
  const raw = withoutBlanks(process.env);

  if (process.env.SKIP_ENV_VALIDATION) {
    // Build-time only (no real env). Never throws; runtime must provide the
    // real values.
    const partial = schema.partial().safeParse(raw);
    return (partial.success ? partial.data : raw) as Env;
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map(
      (i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`,
    );
    console.error(`Invalid environment:\n${lines.join("\n")}`);
    throw new Error("Environment validation failed");
  }
  return parsed.data;
}

export const env: Env = load();
